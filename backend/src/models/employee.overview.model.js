import { query } from "../config/db.js";

// Round to centavos so a fully-spent balance reads exactly 0 instead of a
// floating-point residue (same helper the expenses model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Per-employee overview aggregates — every figure is scoped to the logged-in
// user's `user_id` (passed in from the auth middleware via the controller).
//   - totalBudget:   SUM(issued_budget.amount) through the employee's OPEN
//                    budget_issued_reference rows ("Total Budget Issued")
//   - totalExpenses: SUM(expenses.total_amount) of PAID rows only. A
//                    soft-deleted row is parked in 'draft' and a voided one
//                    sits in 'cancel' (see the row actions), so neither may
//                    read as spent here. The transaction feed below still
//                    LISTS every status — drafts/cancels carry an identifying
//                    badge client-side — which is exactly why these totals
//                    stay paid-only instead of following the list.
//   - totalAbono:    SUM(employee_abono.amount) of OPEN rows only — a settled
//                    (reimbursed) or draft (parked) abono no longer funds
//                    spending, so it never reaches the "Abono" card
//   - totalBalance:  what the employee can still spend
//                    (issued + OPEN abono − PAID expenses − sent transfers +
//                    received transfers). Only 'success' transfers move money —
//                    a 'cancel' row is an audit trail and never counts.
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
            WHERE e.user_id = $1 AND e.status = 'paid'
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT COUNT(*)
            FROM expenses e
            WHERE e.user_id = $1 AND e.status = 'paid'
          ), 0)::int AS expense_count,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            WHERE ea.user_id = $1 AND ea.status = 'open'
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT COUNT(*)
            FROM employee_abono ea
            WHERE ea.user_id = $1
          ), 0)::int AS abono_count,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            WHERE bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          COALESCE((
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = $1 AND btr.status = 'success'
          ), 0)::float8 AS total_received`,
      [userId],
    );

    const row = statsResult.rows[0] ?? {};
    const totalBudget = toMoney(row.total_budget);
    const totalExpenses = toMoney(row.total_expenses);
    const totalAbono = toMoney(row.total_abono);
    const totalSent = toMoney(row.total_sent);
    const totalReceived = toMoney(row.total_received);

    // Fetch individual transactions for this employee across issued budget,
    // expenses, abono, and budget transfers (success only — transfers complete
    // or not at all, so there is no draft state to list). Abono rows carry
    // `date_settled` so the details sheet can show when a settled abono was
    // closed out (other kinds carry NULL). Transfer rows carry `direction`
    // ('sent' | 'received') and the other party's name as `counterparty`.
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
        OR t.direction ILIKE $2
        OR t.counterparty ILIKE $2
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
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          bir.reference_id,
          0 AS flag,
          ib.created_at AS date,
          ib.created_at AS created_at,
          NULL AS direction,
          NULL AS counterparty
        FROM issued_budget ib
        JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
        LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
        WHERE bir.user_id = $1

        UNION ALL

        -- 2. Expense transactions — EVERY status is listed (paid / draft /
        --    cancel) so the ledger shows the full record; only the aggregate
        --    subqueries above stay paid-only, so no total moves.
        SELECT
          e.id,
          'expense' AS kind,
          e.total_amount::float8 AS amount,
          e.description,
          COALESCE(e.notes, c.category_name) AS notes,
          e.payment_method AS method,
          e.status,
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          e.reference_id,
          e.flag AS flag,
          e.created_at AS date,
          e.created_at AS created_at,
          NULL AS direction,
          NULL AS counterparty
        FROM expenses e
        LEFT JOIN category c ON c.category_id = e.category_id
        LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
        WHERE e.user_id = $1

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
          ea.date_settled,
          br.label AS reference_label,
          ea.reference_id,
          0 AS flag,
          ea.created_at AS date,
          ea.created_at AS created_at,
          NULL AS direction,
          NULL AS counterparty
        FROM employee_abono ea
        LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
        WHERE ea.user_id = $1

        UNION ALL

        -- 4. Budget transfers sent — money leaving this employee's pool.
        SELECT
          bt.id,
          'transfer' AS kind,
          bt.amount::float8 AS amount,
          COALESCE(
            NULLIF(TRIM(bt.notes), ''),
            'Budget transfer to ' || COALESCE(ru.name, 'employee')
          ) AS description,
          bt.notes,
          bt.method,
          bt.status,
          NULL::timestamptz AS date_settled,
          NULL AS reference_label,
          bt.reference_id,
          0 AS flag,
          bt.created_at AS date,
          bt.created_at AS created_at,
          'sent' AS direction,
          ru.name AS counterparty
        FROM budget_transfer bt
        LEFT JOIN users ru ON ru.user_id = bt.transfer_to
        WHERE bt.user_id = $1 AND bt.status = 'success'

        UNION ALL

        -- 5. Budget transfers received — money entering this employee's pool.
        SELECT
          bt.id,
          'transfer' AS kind,
          bt.amount::float8 AS amount,
          COALESCE(
            NULLIF(TRIM(bt.notes), ''),
            'Budget transfer from ' || COALESCE(su.name, 'employee')
          ) AS description,
          bt.notes,
          bt.method,
          bt.status,
          NULL::timestamptz AS date_settled,
          NULL AS reference_label,
          bt.reference_id,
          0 AS flag,
          bt.created_at AS date,
          bt.created_at AS created_at,
          'received' AS direction,
          su.name AS counterparty
        FROM budget_transfer bt
        LEFT JOIN users su ON su.user_id = bt.user_id
        WHERE bt.transfer_to = $1 AND bt.status = 'success'
      )
      SELECT * FROM all_tx t
      ${searchFilter}
      -- Newest first by when the record was ADDED — not by the business date
      -- an expense was booked for. One merge across issued/expense/abono and
      -- transfers, so a row entered today always sits above anything older,
      -- whatever table it came from. The date column stays the displayed (and
      -- date-filtered) value.
      ORDER BY t.created_at DESC NULLS LAST, t.date DESC
    `;

    const txResult = await query(txQuery, txParams);

    return {
      totalBudget,
      totalExpenses,
      totalAbono,
      totalSent,
      totalReceived,
      totalBalance: toMoney(
        totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
      ),
      activeReferences: Number(row.active_references) || 0,
      expenseCount: Number(row.expense_count) || 0,
      abonoCount: Number(row.abono_count) || 0,
      transactions: txResult.rows,
    };
  }
}

export default EmployeeOverview;
