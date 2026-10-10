-- 010: backfill `budget_issued_reference.balance_forwarded` with each
-- record's remaining balance: live `issued_budget` children + OPEN abono −
-- PAID expenses, under open sources (the same rules as the reimbursement
-- per-record `balance`). Fresh installs already get the column
-- (`DEFAULT 0`) from schema.sql.
--
-- Every statement is guarded / idempotent so the file is safe to re-run
-- (re-runs simply recompute the stored balance from live rows).

-- 1) Bring the column when missing (no-op when it was added manually or on
-- fresh installs).
ALTER TABLE budget_issued_reference
  ADD COLUMN IF NOT EXISTS balance_forwarded DECIMAL(12,2) DEFAULT 0;

-- 2) One stored remaining per issuance record. Abono/spent legs join by
-- (user_id, reference_id) exactly like the reimbursement per-record legs,
-- so the stored value matches the `balance` the ledger displays.
-- Closed sources leave no footsteps: legs under a cut-off source sum to 0.
UPDATE budget_issued_reference bir
   SET balance_forwarded = (
         COALESCE((
           SELECT SUM(ib.amount)
             FROM issued_budget ib
             JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE ib.issued_ref_id = bir.id
              AND ib.status != 'cancel'
              AND br.status = 'open'
         ), 0)
         + COALESCE((
           SELECT SUM(ea.amount)
             FROM employee_abono ea
             JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.user_id = bir.user_id
              AND ea.reference_id = bir.reference_id
              AND ea.status = 'open'
              AND br.status = 'open'
         ), 0)
         - COALESCE((
           SELECT SUM(e.total_amount)
             FROM expenses e
             JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.user_id = bir.user_id
              AND e.reference_id = bir.reference_id
              AND e.status = 'paid'
              AND br.status = 'open'
         ), 0)
       );
