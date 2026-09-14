import { query } from "../config/db.js";

class Budget {
  // Budget Overview

  static async budgetOverview() {
    const overviewBudget = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(b.amount), 0) AS amount
       FROM budget_reference br
       LEFT JOIN budget b ON b.reference_id = br.reference_id
       WHERE b.status != 'cancelled'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

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
      `INSERT INTO budget (reference_id, amount, description, method, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
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

  static async employeesWithBudget() {
    const result = await query(
      `SELECT
          bir.id AS issued_ref_id,
          bir.user_id,
          u.name,
          br.reference_id,
          br.label,
          COUNT(i.id)::int AS total_budget_issued,
          COALESCE(SUM(i.amount), 0) AS total_amount,
          MAX(i.created_at) AS recent_date
       FROM budget_issued_reference bir
          LEFT JOIN users u
          ON bir.user_id = u.user_id
          LEFT JOIN budget_reference br
          ON br.reference_id = bir.reference_id
          LEFT JOIN issued_budget i
          ON i.issued_ref_id = bir.id
       WHERE bir.status = 'open'
       GROUP BY bir.id, bir.user_id, u.user_id, u.name,
                br.reference_id, br.label
       ORDER BY u.name ASC, bir.created_at DESC`,
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
            WHERE b.reference_id = $1 AND b.status != 'cancelled'
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

  // Budget Transaction — all budget rows with their reference label.
  // Optional filters:
  //   - `status`: 'closed' | 'cancelled' | 'added'; 'all' (or falsy) skips the filter
  //   - `search`: matched against description and reference label (ILIKE)
  // NOTE: `RETURNING` is only valid on INSERT/UPDATE/DELETE — this is a SELECT,
  // so the columns are selected directly and ALL rows are returned (the UI
  // renders a list, not a single row).
  static async budgetTransaction({ status, search } = {}) {
    const where = [];
    const params = [];

    if (status && status !== "all") {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(
        `(b.description ILIKE $${params.length} OR br.label ILIKE $${params.length})`,
      );
    }

    // `::float8` casts DECIMAL (returned by pg as strings) to a JS number.
    const result = await query(
      `SELECT
          b.id,
          b.description,
          b.amount::float8 AS amount,
          b.method,
          b.status,
          b.approved_by,
          b.approved_at,
          b.created_at,
          br.label
       FROM budget b
       LEFT JOIN budget_reference br ON br.reference_id = b.reference_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY b.created_at DESC`,
      params,
    );
    return result.rows;
  }

  // Cancel a budget transaction — sets status = 'cancelled' and stamps
  // cancelled_at. Returns the previous status (so the UI can offer an undo)
  // plus the updated row, or null when the id does not exist.
  static async cancelBudget(id) {
    const existing = await query(
      `SELECT id, status FROM budget WHERE id = $1`,
      [id],
    );
    const previous = existing.rows[0] ?? null;
    if (!previous) return null;

    const result = await query(
      `UPDATE budget
          SET status = 'cancelled',
              cancelled_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id],
    );
    return { previousStatus: previous.status, budget: result.rows[0] };
  }

  // Undo a cancellation — restore the transaction to its previous status
  // ('added' | 'closed') and clear the cancellation stamp.
  static async restoreBudget(id, status) {
    const result = await query(
      `UPDATE budget
          SET status = $2,
              cancelled_at = NULL,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, status],
    );
    return result.rows[0] ?? null;
  }
}

export default Budget;
