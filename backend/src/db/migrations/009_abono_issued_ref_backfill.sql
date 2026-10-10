-- 009: ensure `employee_abono.issued_ref_id` exists and is stamped with the
-- `budget_issued_reference.id` backing each row. Abono saves resolve the
-- OPEN holding for (user, reference) server-side (see Abono.create), so every
-- row connects to its issuance record. Fresh installs already get the column
-- from schema.sql.
--
-- Every statement is guarded / idempotent so the file is safe to re-run.

-- 1) Bring the column back when missing (no-op on fresh installs).
ALTER TABLE employee_abono
  ADD COLUMN IF NOT EXISTS issued_ref_id UUID;

-- 2) Re-attach the FK to the issuance record (ON DELETE CASCADE matches
-- schema.sql). Guarded on the column's actual FK so re-runs never double-add.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'employee_abono'::regclass
       AND a.attname = 'issued_ref_id'
       AND c.contype = 'f'
  ) THEN
    ALTER TABLE employee_abono
      ADD CONSTRAINT employee_abono_issued_ref_id_fkey
      FOREIGN KEY (issued_ref_id)
      REFERENCES budget_issued_reference(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Backfill rows saved without a link: oldest holding for (user, reference).
UPDATE employee_abono ea
   SET issued_ref_id = holder.id
  FROM (
    SELECT DISTINCT ON (bir.user_id, bir.reference_id)
           bir.id, bir.user_id, bir.reference_id
      FROM budget_issued_reference bir
     ORDER BY bir.user_id, bir.reference_id, bir.created_at ASC
  ) holder
 WHERE ea.issued_ref_id IS NULL
   AND holder.user_id = ea.user_id
   AND holder.reference_id = ea.reference_id;
