import { query } from "../config/db.js";

class Budget {
  // Budget Overview
  static async budgetOverview() {
    // const overview = await query(

    // )
    return null;
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
