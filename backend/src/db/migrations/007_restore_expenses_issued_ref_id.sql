-- 007: restore `expenses.issued_ref_id`. Migration 006 dropped it when nothing
-- read or wrote it — but employee expense saves now stamp the OPEN
-- `budget_issued_reference` row the spend was issued from (see
-- `Expenses.createExpenses` + the expenses controller create flow), so the
-- link column must exist on migrated databases too. Fresh installs already
-- get it from schema.sql.
--
-- Every statement is guarded / idempotent so the file is safe to re-run.
-- The column stays NULLABLE: admin saves and employee saves without an open
-- holding store NULL — only an employee spending from an open issuance
-- carries a value.

-- 1) Bring the column back when 006 removed it (no-op on fresh installs).
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS issued_ref_id UUID;

-- 2) Re-attach the foreign key to the issuance record (ON DELETE CASCADE
-- matches the original schema.sql design). Guarded on the column's actual
-- FK so fresh installs (auto-named constraint) and migrated DBs never
-- double-add it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'expenses'::regclass
       AND a.attname = 'issued_ref_id'
       AND c.contype = 'f'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_issued_ref_id_fkey
      FOREIGN KEY (issued_ref_id)
      REFERENCES budget_issued_reference(id)
      ON DELETE CASCADE;
  END IF;
END $$;
