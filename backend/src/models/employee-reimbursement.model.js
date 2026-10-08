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
//   - cash:         what the pool still holds (given − issued − open abono).
//   - personnel:    one row per account holding an OPEN issuance, grouped by
//                   budget_issued_reference.user_id joined through
//                   budget_reference.reference_id for the source label(s).
class EmployeeReimbursement {
  // Back-compat list for GET /employee-reimbursements — every abono row
  // across employees, same shape as the admin abono ledger.
  static async list({ search } = {}) {
    return Abono.listAll({ search });
  }

  static async overview() {
    const [totalsResult, byEmployeeResult, timelineResult, personnelRows] =
      await Promise.all([
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
                 LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
                WHERE e.status = 'paid'
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
                  COUNT(DISTINCT bir.reference_id)::int AS reference_count,
                  COALESCE(SUM(ib.amount), 0)::float8 AS issued,
                  COALESCE(ab.open_abono, 0)::float8 AS open_abono,
                  COALESCE(ab.open_abono_count, 0)::int AS open_abono_count,
                  COALESCE(ex.spent, 0)::float8 AS spent,
                  COALESCE(ex.expense_count, 0)::int AS expense_count
             FROM users u
             JOIN budget_issued_reference bir ON bir.user_id = u.user_id
               AND bir.status = 'open'
             JOIN budget_reference br ON br.reference_id = bir.reference_id
               AND br.status = 'open'
             LEFT JOIN issued_budget ib ON ib.issued_ref_id = bir.id
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
            GROUP BY u.user_id, u.name, u.email, u.avatar_url, u.role,
                     ab.open_abono, ab.open_abono_count, ex.spent, ex.expense_count
            ORDER BY issued DESC`,
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
          openAbono: rowAbono,
          openAbonoCount: Number(r.open_abono_count) || 0,
          spent: rowSpent,
          expenseCount: Number(r.expense_count) || 0,
          balance: toMoney(rowIssued + rowAbono - rowSpent),
        };
      }),
    };
  }
}

export default EmployeeReimbursement;
