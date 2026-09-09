import { query } from "../config/db.js";

// Columns safe to return in API responses
const SAFE_COLUMNS =
  "id, user_id, amount, description, method, status, approved_by, submitted_at, approved_at, cancelled_at, created_at, updated_at";

class Budget {
  // Create Budget
  static async createBudget({ user_id, amount, description, method, approved_by }) {
    const result = await query(
      `INSERT INTO budget (user_id, amount, description, method, approved_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SAFE_COLUMNS}`,
      [user_id, amount, description, method, approved_by],
    );
    return result.rows[0];
  }
}

export default Budget;