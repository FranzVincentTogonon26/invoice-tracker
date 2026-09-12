import { query } from "../config/db.js";

class Budget {
  // Budget Overview
  // - `overviewBudget`: one row per open budget_reference — { label, created_at,
  //   amount } where `amount` is the SUM of that reference's `budget.amount`
  //   rows. Grouping by reference keeps the breakdown readable when a
  //   reference has several budget entries.
  // - `overviewIssuedBudget`: one row per reference with SUM(i.amount) as the
  //   issued subtotal — { label, created_at, amount }.
  // `totalBudget` / `totalIssued` are pre-summed server-side because pg
  // returns DECIMAL(12,2) as strings — summing them in JS would concatenate.
  static async budgetOverview() {
    const overviewBudget = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(b.amount), 0) AS amount
       FROM budget_reference br
       LEFT JOIN budget b ON b.reference_id = br.reference_id
       WHERE br.status = 'open'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // Issued breakdown: one row per reference with SUM(i.amount) as the
    // subtotal. `GROUP BY bir.reference_id` alone is NOT valid here — every
    // non-aggregated column in the SELECT (and in ORDER BY) must be in the
    // GROUP BY clause, so we group by the reference identity columns and sort
    // by br.created_at (i.created_at is per-entry and can't survive grouping).
    const overviewIssuedBudget = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(i.amount), 0) AS amount
       FROM budget_issued_reference bir
       JOIN issued_budget i ON i.issued_ref_id = bir.id
       JOIN budget_reference br ON br.reference_id = bir.reference_id
       WHERE bir.status = 'open'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // pg returns DECIMAL as strings — cast before summing.
    const totalBudget = overviewBudget.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const totalIssued = overviewIssuedBudget.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    // Return `.rows` (not the raw pg result) so the API payload is a plain
    // array — the frontend consumes these directly.
    return {
      overviewBudget: overviewBudget.rows,
      overviewIssuedBudget: overviewIssuedBudget.rows,
      totalBudget,
      totalIssued,
    };
  }

  // Create Budget Reference
  // `reference_id` is intentionally omitted from the INSERT so the column's
  // `DEFAULT gen_random_uuid()` applies — inserting an explicit NULL would
  // violate the NOT NULL constraint (defaults don't fire for explicit NULLs).
  static async createReferenceBudget({ label }) {
    const result = await query(
      `INSERT INTO budget_reference (label)
       VALUES ($1)
       RETURNING *`,
      [label],
    );
    return result.rows[0];
  }

  // Create Budget
  static async createBudget({
    reference_id,
    amount,
    description,
    method,
    approved_by,
  }) {
    const result = await query(
      `INSERT INTO budget (reference_id, amount, description, method, approved_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reference_id, amount, description, method, approved_by],
    );
    return result.rows[0];
  }

  // Create Issued Budget
  static async createIssuedReferenceBudget({ reference_id, user_id }) {
    const result = await query(
      `INSERT INTO budget_issued_reference
         (reference_id, user_id, date_cut_off)
       VALUES
         ($1, $2, NOW() + INTERVAL '1 month')
       RETURNING *`,
      [reference_id, user_id],
    );
    return result.rows[0];
  }

  // Create Issued Budget
  static async createIssuedBudget({
    issuedRefBudget,
    amount,
    description,
    method,
    note,
  }) {
    const result = await query(
      `INSERT INTO issued_budget
         (issued_ref_id, amount, description, method, notes)
       VALUES
         ($1, $2, $3, $4, $5)
       RETURNING *`,
      [issuedRefBudget, amount, description, method, note],
    );
    return result.rows[0];
  }

  // Lists Employee Budgets
  // `issued_budget` has no `user_id`/`status` columns — the employee link and
  // open/closed status live on `budget_issued_reference` (via issued_ref_id).
  static async employeesWithBudget() {
    const result = await query(
      `SELECT
          bir.user_id,
          u.name,
          SUM(i.amount) as total_amount,
          MAX(i.created_at) as recent_date,
          COUNT(bir.user_id) as total_budget_issued
       FROM issued_budget i
          JOIN budget_issued_reference bir ON i.issued_ref_id = bir.id
          LEFT JOIN users u
          ON bir.user_id = u.user_id
       WHERE bir.status = 'open'
       GROUP BY bir.user_id, u.user_id, u.name
       ORDER BY MAX(i.created_at) DESC`,
      [],
    );

    return result.rows;
  }

  // Budget Reference
  static async budgetReference() {
    const result = await query(
      `SELECT 
        reference_id, 
        label, created_at, 
        ( SELECT COUNT(id) FROM budget bi WHERE bi.reference_id = b.reference_id ) AS active 
       FROM budget_reference b
       WHERE b.status = 'open'
       ORDER BY b.created_at DESC`,
      [],
    );

    return result.rows;
  }

  // Balance summary for one budget_reference:
  // - `allocated`: SUM(budget.amount) — total funds added to this reference
  // - `issued`:    SUM(issued_budget.amount) — funds already handed out via
  //                budget_issued_reference rows tied to this reference
  // - `balance`:   allocated - issued (what can still be issued)
  // Scalar subqueries with COALESCE keep empty references at 0 instead of NULL
  // (SUM returns NULL over zero rows).
  static async referenceBalance(referenceId) {
    const result = await query(
      `SELECT
          COALESCE((
            SELECT SUM(b.amount)
            FROM budget b
            WHERE b.reference_id = $1
          ), 0) AS allocated,
          COALESCE((
            SELECT SUM(i.amount)
            FROM issued_budget i
            JOIN budget_issued_reference bir ON i.issued_ref_id = bir.id
            WHERE bir.reference_id = $1
          ), 0) AS issued`,
      [referenceId],
    );

    const row = result.rows[0] ?? { allocated: 0, issued: 0 };
    const allocated = Number(row.allocated);
    const issued = Number(row.issued);
    return { allocated, issued, balance: allocated - issued };
  }

  // Soft-delete a Budget Reference (status 'open' -> 'cut_off'). A hard
  // DELETE would cascade-destroy the dependent `budget` and

  static async deleteReference(referenceId) {
    const result = await query(
      // `FROM` is required — `DELETE budget_reference WHERE ...` is a
      // Postgres syntax error (42601).
      `DELETE FROM budget_reference
        WHERE reference_id = $1
        RETURNING *`,
      [referenceId],
    );
    return result.rows[0] ?? null;
  }
}

export default Budget;
