import { query } from "../config/db.js";

class Budget {
  // Create Budget
  static async createBudget({ amount, description, method, approved_by }) {
    const result = await query(
      `INSERT INTO budget (amount, description, method, approved_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [amount, description, method, approved_by],
    );
    return result.rows[0];
  }

  // Lists Employee Budgets
  static async employeesWithBudget() {
    const result = await query(
      `SELECT
          b.user_id,
          u.name,
          SUM(b.amount) as total_amount,
          MAX(b.created_at) as recent_date,
          COUNT(b.user_id) as total_budget_issued
       FROM budget b
          LEFT JOIN users u
          ON b.user_id = u.user_id
       WHERE b.status = 'pending' AND b.cut_off = false
       GROUP BY b.user_id, u.user_id, u.name
       ORDER BY MAX(b.updated_at) DESC`,
      [],
    );

    return result.rows;
  }
}

export default Budget;
