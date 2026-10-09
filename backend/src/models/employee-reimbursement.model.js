import { query } from "../config/db.js";
import Abono from "./abono.model.js";

// Round to centavos so a fully-spent balance reads exactly 0 instead of a
// floating-point residue (same helper every overview model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Admin → Employee Reimbursement aggregates. Closed sources leave no
// footsteps: every sum below only counts rows under an open
// `budget_reference`, mirroring the employee overview + source-funds rules.
//   - given:        SUM(budget.amount) of live rows ('added' | 'closed');
//                   cancelled rows move no money.
//   - issued:       SUM(issued_budget.amount) through OPEN
//                   budget_issued_reference rows.
//   - openAbono:    SUM(employee_abono.amount) of OPEN rows — a settled
//                   (reimbursed) abono no longer funds the pool.
//   - spent:        SUM(expenses.total_amount) of PAID admin rows only —
//                   mirrors ExpenseOverview's totalExpenses (employee spend
//                   already left the pool as `issued`, so counting it again
//                   would subtract it twice).
//   - cash:         what the pool still holds (given − issued − open abono).
//   - personnel:    one row per account with issuance history (any status)
//                   under an open source, or holding open abono — grouped by
//                   budget_issued_reference.user_id joined through
//                   budget_reference.reference_id for the source label(s).
//                   The issued leg counts every issuance (any status) under
//                   open sources; abono stays open-only and spent stays paid.
class EmployeeReimbursement {
  // Back-compat list for GET /employee-reimbursements — every abono row
  // across employees, same shape as the admin abono ledger.
  static async list({ search } = {}) {
    return Abono.listAll({ search });
  }

  static async overview() {
    const [
      totalsResult,
      byEmployeeResult,
      timelineResult,
      personnelRows,
      givenBreakdownResult,
      issuedBreakdownResult,
      spentBreakdownResult,
      issuedStatusCountsResult,
    ] = await Promise.all([
        query(
          `SELECT
             COALESCE((
               SELECT SUM(b.amount)
                 FROM budget b
                 JOIN budget_reference br ON br.reference_id = b.reference_id
                WHERE b.status != 'cancelled'
                  AND br.status = 'open'
             ), 0)::float8 AS given,
             COALESCE((
               SELECT COUNT(DISTINCT b.reference_id)
                 FROM budget b
                 JOIN budget_reference br ON br.reference_id = b.reference_id
                WHERE b.status != 'cancelled'
                  AND br.status = 'open'
             ), 0)::int AS given_sources,
              COALESCE((
                SELECT SUM(ib.amount)
                  FROM budget_issued_reference bir
                  JOIN issued_budget ib ON ib.issued_ref_id = bir.id
                  JOIN budget_reference br ON br.reference_id = bir.reference_id
                 WHERE bir.status = 'open'
                   AND br.status = 'open'
                   AND ib.status != 'cancel'
              ), 0)::float8 AS issued,
             COALESCE((
               SELECT SUM(ea.amount)
                 FROM employee_abono ea
                 JOIN budget_reference br ON br.reference_id = ea.reference_id
                WHERE ea.status = 'open'
                  AND br.status = 'open'
             ), 0)::float8 AS open_abono,
             COALESCE((
               SELECT COUNT(*)
                 FROM employee_abono ea
                 JOIN budget_reference br ON br.reference_id = ea.reference_id
                WHERE ea.status = 'open'
                  AND br.status = 'open'
             ), 0)::int AS open_abono_count,
             COALESCE((
               SELECT SUM(ea.amount)
                 FROM employee_abono ea
                 JOIN budget_reference br ON br.reference_id = ea.reference_id
                WHERE ea.status = 'settled'
                  AND br.status = 'open'
             ), 0)::float8 AS settled_abono,
             COALESCE((
               SELECT COUNT(*)
                 FROM employee_abono ea
                 JOIN budget_reference br ON br.reference_id = ea.reference_id
                WHERE ea.status = 'settled'
                  AND br.status = 'open'
             ), 0)::int AS settled_abono_count,
             COALESCE((
               SELECT COUNT(DISTINCT bir.user_id)
                 FROM budget_issued_reference bir
                 JOIN budget_reference br ON br.reference_id = bir.reference_id
                WHERE bir.status = 'open'
                  AND br.status = 'open'
             ), 0)::int AS personnel_count,
              COALESCE((
                SELECT SUM(e.total_amount)
                  FROM expenses e
                  JOIN users u ON u.user_id = e.user_id
                  LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
                 WHERE e.status = 'paid'
                   AND u.role = 'admin'
                   AND (e.reference_id IS NULL OR br.status = 'open')
              ), 0)::float8 AS spent`,
        ),
        query(
          `SELECT u.user_id,
                  u.name,
                  u.avatar_url,
                  COUNT(*)::int AS open_count,
                  COALESCE(SUM(ea.amount), 0)::float8 AS open_total
             FROM employee_abono ea
             JOIN users u ON u.user_id = ea.user_id
             JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.status = 'open'
              AND br.status = 'open'
            GROUP BY u.user_id, u.name, u.avatar_url
            ORDER BY open_total DESC`,
        ),
        query(
          `SELECT b.created_at AS date,
                  b.amount::float8 AS amount,
                  'given' AS kind
             FROM budget b
             JOIN budget_reference br ON br.reference_id = b.reference_id
            WHERE b.status != 'cancelled'
              AND br.status = 'open'
            UNION ALL
            SELECT ea.created_at AS date,
                   ea.amount::float8 AS amount,
                   ea.status AS kind
              FROM employee_abono ea
              JOIN budget_reference br ON br.reference_id = ea.reference_id
             WHERE ea.status IN ('open', 'settled')
               AND br.status = 'open'
            ORDER BY date`,
        ),
        query(
          `SELECT u.user_id,
                  u.name,
                  u.email,
                  u.avatar_url,
                  u.role,
                  COALESCE(STRING_AGG(DISTINCT br.label, ', '), '') AS reference_labels,
                  COUNT(DISTINCT br.reference_id)::int AS reference_count,
                  COALESCE(SUM(ib.amount), 0)::float8 AS issued,
                  COUNT(ib.id)::int AS issued_count,
                  COALESCE(ab.open_abono, 0)::float8 AS open_abono,
                  COALESCE(ab.open_abono_count, 0)::int AS open_abono_count,
                  COALESCE(ex.spent, 0)::float8 AS spent,
                  COALESCE(ex.expense_count, 0)::int AS expense_count,
                  COALESCE((
                    SELECT STRING_AGG(DISTINCT bir2.status, ',' ORDER BY bir2.status)
                      FROM budget_issued_reference bir2
                      JOIN budget_reference br2 ON br2.reference_id = bir2.reference_id
                       AND br2.status = 'open'
                     WHERE bir2.user_id = u.user_id
                  ), '') AS bir_statuses
             FROM users u
             -- Every account with issuance HISTORY under an open source (any
             -- bir status, not just open) or holding open abono shows up, so
             -- no recorded row stays hidden from the ledger. Pure
             -- expense-only accounts (no issuance, no abono) still stay out.
             -- The issued leg counts EVERY issuance (any parent/child status)
             -- under open sources, so closed and cancelled money still reads
             -- here; rows under a cut-off source stay excluded everywhere.
             LEFT JOIN budget_issued_reference bir ON bir.user_id = u.user_id
             LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
               AND br.status = 'open'
             LEFT JOIN issued_budget ib
               ON ib.issued_ref_id = bir.id
              AND br.reference_id IS NOT NULL
             LEFT JOIN (
               SELECT ea.user_id,
                      SUM(ea.amount)::float8 AS open_abono,
                      COUNT(*)::int AS open_abono_count
                 FROM employee_abono ea
                 JOIN budget_reference br2 ON br2.reference_id = ea.reference_id
                WHERE ea.status = 'open'
                  AND br2.status = 'open'
                GROUP BY ea.user_id
             ) ab ON ab.user_id = u.user_id
             LEFT JOIN (
               SELECT e.user_id,
                      SUM(e.total_amount)::float8 AS spent,
                      COUNT(*)::int AS expense_count
                 FROM expenses e
                 LEFT JOIN budget_reference br3 ON br3.reference_id = e.reference_id
                WHERE e.status = 'paid'
                  AND (e.reference_id IS NULL OR br3.status = 'open')
                GROUP BY e.user_id
             ) ex ON ex.user_id = u.user_id
             WHERE EXISTS (
               SELECT 1
                 FROM budget_issued_reference b2
                 JOIN budget_reference br2 ON br2.reference_id = b2.reference_id
                  AND br2.status = 'open'
                WHERE b2.user_id = u.user_id
             ) OR EXISTS (
               SELECT 1
                 FROM employee_abono ea2
                 JOIN budget_reference br2 ON br2.reference_id = ea2.reference_id
                  AND br2.status = 'open'
                WHERE ea2.user_id = u.user_id
                  AND ea2.status = 'open'
             )
             GROUP BY u.user_id, u.name, u.email, u.avatar_url, u.role,
                     ab.open_abono, ab.open_abono_count, ex.spent, ex.expense_count
             ORDER BY issued DESC`,
        ),
        // Per-reference allocation list for the Money In card — same shape
        // as Budget.budgetOverview().overviewBudget so the frontend can
        // render the identical "Allocated" breakdown.
        query(
          `SELECT
              br.reference_id,
              br.label,
              br.created_at,
              COALESCE(SUM(b.amount), 0)::float8 AS amount
             FROM budget_reference br
             LEFT JOIN budget b ON b.reference_id = br.reference_id
            WHERE b.status != 'cancelled'
              AND br.status = 'open'
            GROUP BY br.reference_id, br.label, br.created_at
            ORDER BY br.created_at DESC`,
        ),
        // Per-reference issuance list for the My Balance "Remaining"
        // breakdown — same shape as Budget's overviewIssuedBudget.
        query(
          `SELECT
              br.reference_id,
              br.label,
              br.created_at,
              COALESCE(SUM(ib.amount), 0)::float8 AS amount
             FROM budget_issued_reference bir
             JOIN issued_budget ib ON ib.issued_ref_id = bir.id
             JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.status = 'open'
              AND br.status = 'open'
              AND ib.status != 'cancel'
            GROUP BY br.reference_id, br.label, br.created_at
            ORDER BY br.created_at DESC`,
        ),
        // Per-reference admin-spend list for the My Balance "Remaining"
        // breakdown. LEFT JOIN (not INNER) so untagged admin expenses land
        // in their own NULL group instead of vanishing — the groups must
        // partition the headline `spent` exactly.
        query(
          `SELECT
              br.reference_id,
              br.label,
              br.created_at,
              COALESCE(SUM(e.total_amount), 0)::float8 AS amount
             FROM expenses e
             JOIN users u ON u.user_id = e.user_id
             LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.status = 'paid'
              AND u.role = 'admin'
              AND (e.reference_id IS NULL OR br.status = 'open')
            GROUP BY br.reference_id, br.label, br.created_at
            ORDER BY br.created_at DESC NULLS LAST`,
        ),
        // Issuance counts by `budget_issued_reference.status` for the Total
        // Abono card rows. Scoped to open sources like every other figure on
        // the page (rows under a cut-off source leave no footsteps).
        query(
          `SELECT bir.status,
                  COUNT(*)::int AS n
             FROM budget_issued_reference bir
             JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE br.status = 'open'
            GROUP BY bir.status`,
        ),
      ]);

    const t = totalsResult.rows[0] ?? {};
    const given = toMoney(t.given);
    const issued = toMoney(t.issued);
    const openAbono = toMoney(t.open_abono);
    const abonoCount = Number(t.open_abono_count) || 0;

    return {
      moneyIn: given,
      given,
      givenSources: Number(t.given_sources) || 0,
      givenBreakdown: (givenBreakdownResult.rows ?? []).map((r) => ({
        reference_id: r.reference_id,
        label: r.label,
        created_at: r.created_at,
        amount: toMoney(r.amount),
      })),
      issuedBreakdown: (issuedBreakdownResult.rows ?? []).map((r) => ({
        reference_id: r.reference_id,
        label: r.label,
        created_at: r.created_at,
        amount: toMoney(r.amount),
      })),
      spentBreakdown: (spentBreakdownResult.rows ?? []).map((r) => ({
        reference_id: r.reference_id,
        label: r.label ?? "No source of funds",
        created_at: r.created_at,
        amount: toMoney(r.amount),
      })),
      issuedStatusCounts: (() => {
        const counts = { open: 0, close: 0, cancel: 0 };
        for (const r of issuedStatusCountsResult.rows ?? []) {
          if (r.status in counts) counts[r.status] = Number(r.n) || 0;
        }
        return counts;
      })(),
      abonoIn: openAbono,
      abonoCount,
      budget: given,
      issued,
      openAbono,
      cash: toMoney(given - issued - openAbono),
      settledAbono: toMoney(t.settled_abono),
      settledAbonoCount: Number(t.settled_abono_count) || 0,
      spent: toMoney(t.spent),
      personnelCount: Number(t.personnel_count) || 0,
      abonoByEmployee: (byEmployeeResult.rows ?? []).map((r) => ({
        userId: r.user_id,
        name: r.name,
        avatarUrl: r.avatar_url ?? null,
        openCount: Number(r.open_count) || 0,
        openTotal: toMoney(r.open_total),
      })),
      timeline: (timelineResult.rows ?? []).map((r) => ({
        date: r.date,
        amount: toMoney(r.amount),
        kind: r.kind,
      })),
      personnel: (personnelRows.rows ?? []).map((r) => {
        const rowIssued = toMoney(r.issued);
        const rowAbono = toMoney(r.open_abono);
        const rowSpent = toMoney(r.spent);
        return {
          userId: r.user_id,
          name: r.name,
          email: r.email,
          avatarUrl: r.avatar_url ?? null,
          role: r.role,
          referenceLabels: r.reference_labels || "",
          referenceCount: Number(r.reference_count) || 0,
          issued: rowIssued,
          issuedCount: Number(r.issued_count) || 0,
          openAbono: rowAbono,
          openAbonoCount: Number(r.open_abono_count) || 0,
          spent: rowSpent,
          expenseCount: Number(r.expense_count) || 0,
          birStatuses: r.bir_statuses || "",
          balance: toMoney(rowIssued + rowAbono - rowSpent),
        };
      }),
    };
  }
}

export default EmployeeReimbursement;
