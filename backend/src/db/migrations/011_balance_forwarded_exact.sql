-- 011: recompute `budget_issued_reference.balance_forwarded` with the exact
-- per-record formula (same legs the close flow stamps): each record's own
-- live issued children + its own OPEN abono − its own PAID expenses − its
-- own SETTLED abono (consumed spend the settle flow re-books as issued),
-- keyed on `issued_ref_id = budget_issued_reference.id` so sibling records
-- sharing one source never leak into each other. Earlier stamps grouped by
-- (user_id, reference_id) and omitted settled spend, so they can read wrong
-- (e.g. a leftover that should be 0, or a stale 0 hiding a real leftover).
--
-- Idempotent — safe to re-run (recomputes from live rows every time).

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
            WHERE ea.issued_ref_id = bir.id
              AND ea.user_id = bir.user_id
              AND ea.status = 'open'
              AND br.status = 'open'
         ), 0)
         - COALESCE((
           SELECT SUM(e.total_amount)
             FROM expenses e
             LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.issued_ref_id = bir.id
              AND e.user_id = bir.user_id
              AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
         ), 0)
         - COALESCE((
           SELECT SUM(ea.amount)
             FROM employee_abono ea
             JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.issued_ref_id = bir.id
              AND ea.user_id = bir.user_id
              AND ea.status = 'settled'
              AND br.status = 'open'
         ), 0)
       );
