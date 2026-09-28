-- ============================================================
-- DEDUP OPEN ISSUED REFERENCES + GUARD AGAINST FUTURE DUPLICATES
-- ============================================================
-- Bug: issuing a budget to the same employee from the same source inserted a
-- brand-new `budget_issued_reference` row every time, so repeated top-ups
-- stacked up duplicate parent rows for one (user_id, reference_id) pair.
-- The API now reuses the OPEN parent row (see
-- `Budget.issueBudgetToEmployee`), and this migration:
--   1. merges any duplicates already in the table, then
--   2. adds a partial unique index so at most ONE open row can ever exist
--      per (user_id, reference_id) — the index is also what makes the
--      INSERT ... ON CONFLICT DO NOTHING path race-safe.
--
-- Every statement is guarded / idempotent so the file is safe to re-run.
-- Closed/cancelled rows are untouched: re-issuing after a cancel/close must
-- still be able to create a fresh OPEN row.

-- 1) Re-point children of duplicate OPEN parents onto the keeper row
--    (earliest created per pair), so no issued_budget row is orphaned.
UPDATE issued_budget ib
   SET issued_ref_id = keepers.keeper_id
  FROM (
    SELECT id,
           FIRST_VALUE(id) OVER (
             PARTITION BY user_id, reference_id
             ORDER BY created_at ASC, id ASC
           ) AS keeper_id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, reference_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM budget_issued_reference
     WHERE status = 'open'
  ) AS keepers
 WHERE ib.issued_ref_id = keepers.id
   AND keepers.rn > 1;

-- 2) Delete the duplicate OPEN parents (keeper survives).
DELETE FROM budget_issued_reference bir
 USING (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, reference_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
      FROM budget_issued_reference
     WHERE status = 'open'
  ) AS dupes
 WHERE bir.id = dupes.id
   AND dupes.rn > 1;

-- 3) One OPEN issuance per employee per source, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_issued_reference_open_user_reference
    ON budget_issued_reference(user_id, reference_id)
    WHERE status = 'open';
