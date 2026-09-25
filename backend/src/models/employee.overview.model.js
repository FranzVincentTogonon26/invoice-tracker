import { query } from "../config/db.js";

// Per-employee overview aggregates — every figure is scoped to the logged-in
// user's `user_id` (passed in from the auth middleware via the controller).
//   - totalBudget:   SUM(issued_budget.amount) through the employee's OPEN
//                    budget_issued_reference rows ("Total Budget Issued")
//   - totalExpenses: SUM(expenses.total_amount) excluding cancelled records
//   - totalAbono:    SUM(employee_abono.amount)
//   - totalBalance:  what the employee can still spend
//                    (issued + abono − expenses)
// Counts ride along so the cards can show "N references / N transactions"
// captions without a second round-trip. One query, all scalar subqueries.
class EmployeeOverview {
  static async employeeOverview(userId, { search } = {}) {
    const statsResult = await query(
      `SELECT
          COALESCE((
            SELECT SUM(ib.amount)
            FROM budget_issued_reference bir
            JOIN issued_budget ib ON ib.issued_ref_id = bir.id
            WHERE bir.user_id = $1 AND bir.status = 'open'
          ), 0)::float8 AS total_budget,
          COALESCE((
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            WHERE bir.user_id = $1 AND bir.status = 'open'
          ), 0)::int AS active_references,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            WHERE e.user_id = $1 AND e.status != 'cancel'
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT COUNT(*)
            FROM expenses e
            WHERE e.user_id = $1 AND e.status != 'cancel'
          ), 0)::int AS expense_count,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            WHERE ea.user_id = $1
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT COUNT(*)
            FROM employee_abono ea
            WHERE ea.user_id = $1
          ), 0)::int AS abono_count`,
      [userId],
    );

    const row = statsResult.rows[0] ?? {};
    const totalBudget = Number(row.total_budget) || 0;
    const totalExpenses = Number(row.total_expenses) || 0;
    const totalAbono = Number(row.total_abono) || 0;

    // Fetch individual transactions for this employee across issued budget, expenses, and abono
    const txParams = [userId];
    let searchFilter = "";
    if (search && search.trim()) {
      txParams.push(`%${search.trim()}%`);
      searchFilter = `WHERE (
        t.description ILIKE $2
        OR t.reference_label ILIKE $2
        OR t.method ILIKE $2
        OR t.status ILIKE $2
        OR t.notes ILIKE $2
        OR t.kind ILIKE $2
      )`;
    }

    const txQuery = `
      WITH all_tx AS (
        -- 1. Budget Issued transactions
        SELECT
          ib.id,
          'issued' AS kind,
          ib.amount::float8 AS amount,
          ib.description,
          ib.notes,
          ib.method,
          bir.status,
          br.label AS reference_label,
          bir.reference_id,
          ib.created_at AS date
        FROM issued_budget ib
        JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
        LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
        WHERE bir.user_id = $1

        UNION ALL

        -- 2. Expense transactions
        SELECT
          e.id,
          'expense' AS kind,
          e.total_amount::float8 AS amount,
          e.description,
          COALESCE(e.notes, c.category_name) AS notes,
          e.payment_method AS method,
          e.status,
          br.label AS reference_label,
          e.reference_id,
          COALESCE(e.expense_date::timestamptz, e.created_at) AS date
        FROM expenses e
        LEFT JOIN category c ON c.category_id = e.category_id
        LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
        WHERE e.user_id = $1 AND e.status != 'cancel'

        UNION ALL

        -- 3. Abono transactions
        SELECT
          ea.id,
          'abono' AS kind,
          ea.amount::float8 AS amount,
          ea.description,
          NULL AS notes,
          'cash' AS method,
          ea.status,
          br.label AS reference_label,
          ea.reference_id,
          ea.created_at AS date
        FROM employee_abono ea
        LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
        WHERE ea.user_id = $1
      )
      SELECT * FROM all_tx t
      ${searchFilter}
      ORDER BY t.date DESC
    `;

    const txResult = await query(txQuery, txParams);

    return {
      totalBudget,
      totalExpenses,
      totalAbono,
      totalBalance: totalBudget + totalAbono - totalExpenses,
      activeReferences: Number(row.active_references) || 0,
      expenseCount: Number(row.expense_count) || 0,
      abonoCount: Number(row.abono_count) || 0,
      transactions: txResult.rows,
    };
  }
}

export default EmployeeOverview;

