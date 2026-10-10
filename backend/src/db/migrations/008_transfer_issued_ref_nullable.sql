-- 008: make `budget_transfer.issued_ref_id` nullable + backfill from holdings.
-- Employee sends stamp the sender's OPEN `budget_issued_reference.id`
-- (see BudgetTransfer.createTransfer); admin sends carry NULL — the pool,
-- not a personal issuance, funds them. Fresh installs already get the
-- nullable column from schema.sql.
--
-- Every statement is guarded / idempotent so the file is safe to re-run.

-- 1) Allow NULL for admin-funded transfers.
DO $$
BEGIN
  BEGIN
    ALTER TABLE budget_transfer ALTER COLUMN issued_ref_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- 2) Ensure the FK to the issuance record exists (ON DELETE CASCADE matches
-- schema.sql). Guarded on the column's actual FK so re-runs never double-add.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'budget_transfer'::regclass
       AND a.attname = 'issued_ref_id'
       AND c.contype = 'f'
  ) THEN
    ALTER TABLE budget_transfer
      ADD CONSTRAINT budget_transfer_issued_ref_id_fkey
      FOREIGN KEY (issued_ref_id)
      REFERENCES budget_issued_reference(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Backfill employee-sent rows that were saved without a link: oldest OPEN
-- holding for (sender, reference). Admin rows stay NULL.
UPDATE budget_transfer bt
   SET issued_ref_id = holder.id
  FROM (
    SELECT DISTINCT ON (bir.user_id, bir.reference_id)
           bir.id, bir.user_id, bir.reference_id
      FROM budget_issued_reference bir
     ORDER BY bir.user_id, bir.reference_id, bir.created_at ASC
  ) holder
 WHERE bt.issued_ref_id IS NULL
   AND holder.user_id = bt.user_id
   AND holder.reference_id = bt.reference_id
   AND EXISTS (
     SELECT 1 FROM users u
      WHERE u.user_id = bt.user_id AND u.role = 'employee'
   );
