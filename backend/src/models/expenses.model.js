import { query, withTransaction } from "../config/db.js";

class Expenses {
  // Columns safe to return in API responses.
  static CATEGORY_COLUMNS = "category_id, category_name, created_at";

  /* ── Category ────────────────────────────────────────────────── */

  // All categories, alphabetically — powers the "Select Category" Listbox.
  static async categoryList() {
    const result = await query(
      `SELECT ${this.CATEGORY_COLUMNS}
         FROM category
        ORDER BY category_name ASC`,
      [],
    );
    return result.rows;
  }

  // All selectable Gemini models, alphabetically — powers the "Source" Listbox
  // in the Scan Receipt panel (`ModelSource`).
  static async geminiModel() {
    const result = await query(
      `SELECT id, model
         FROM geminimodel
        ORDER BY model ASC`,
      [],
    );
    return result.rows;
  }

  // Case-insensitive lookup so "Travel" and "travel" don't both get created.
  static async findCategoryByName(category_name) {
    const result = await query(
      `SELECT ${this.CATEGORY_COLUMNS}
         FROM category
        WHERE LOWER(category_name) = LOWER($1)
        LIMIT 1`,
      [category_name],
    );
    return result.rows[0] ?? null;
  }

  static async createCategory({ category_name }) {
    const result = await query(
      `INSERT INTO category (category_name)
       VALUES ($1)
       RETURNING ${this.CATEGORY_COLUMNS}`,
      [category_name],
    );
    return result.rows[0];
  }

  // Deletes a category. `expenses.category_id` is ON DELETE SET NULL, so
  // already-filed expense lines survive as uncategorized.
  static async removeCategory(id) {
    const result = await query(
      `DELETE FROM category
        WHERE category_id = $1
        RETURNING ${this.CATEGORY_COLUMNS}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  /* ── Receipt (scan_receipt) ──────────────────────────────────── */

  static async createReceipt({ image_url, description, qty, rate, amount }) {
    const result = await query(
      `INSERT INTO receipt (image_url, description, qty, rate, amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [image_url ?? null, description, qty, rate, amount],
    );
    return result.rows[0];
  }

  /* ── Expenses ────────────────────────────────────────────────── */

  // Inserts every line in one transaction so a bad row can't leave a partial
  // batch behind. `expense_date` is the date the user picked on the line
  // (defaults to today at the DB level when omitted).
  static async createExpenses({
    items,
    user_id,
    issued_ref_id = null,
    reference_id = null,
  }) {
    return withTransaction(async (client) => {
      const rows = [];

      for (const item of items) {
        const result = await client.query(
          `INSERT INTO expenses
             (user_id, issued_ref_id, reference_id, description, category_id,
              total_amount, expense_date, notes, receipt_id, payment_method)
           VALUES
             ($1, $2, $3, $4, $5, $6,
              COALESCE($7::date, CURRENT_DATE), $8, $9, $10)
           RETURNING *`,
          [
            user_id,
            issued_ref_id,
            reference_id,
            item.description,
            item.category_id ?? null,
            item.total_amount,
            item.expense_date ?? null,
            item.notes ?? null,
            item.receipt_id ?? null,
            item.payment_method ?? "cash",
          ],
        );
        rows.push(result.rows[0]);
      }

      return rows;
    });
  }

  static async removeExpense(id) {
    const result = await query(
      `DELETE FROM expenses
        WHERE id = $1
        RETURNING id, description, total_amount`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  static async budgetReference() {
    const result = await query(
      `SELECT
          b.reference_id,
          b.label,
          b.created_at,
          ( SELECT COUNT(id) FROM budget bi
             WHERE bi.reference_id = b.reference_id ) AS active,
          COALESCE((
            SELECT SUM(bu.amount)
              FROM budget bu
             WHERE bu.reference_id = b.reference_id
               AND bu.status != 'cancelled'
          ), 0)::float8 AS allocated,
          COALESCE((
            SELECT SUM(i.amount)
              FROM issued_budget i
              JOIN budget_issued_reference bir ON i.issued_ref_id = bir.id
             WHERE bir.status = 'open'
               AND bir.reference_id = b.reference_id
          ), 0)::float8 AS issued
         FROM budget_reference b
        WHERE b.status = 'open'
        ORDER BY b.created_at DESC`,
      [],
    );

    // pg hands DECIMALs back as strings and SUM() over zero rows as NULL — coerce
    // both so the client always receives numbers. `balance` is what the source
    // can still spend (allocated − issued) — the same figure
    // `Budget.referenceBalance()` reports, so both screens agree.
    return result.rows.map((row) => {
      const allocated = Number(row.allocated) || 0;
      const issued = Number(row.issued) || 0;
      return { ...row, allocated, issued, balance: allocated - issued };
    });
  }

  /**
   * Overview payload for GET /expenses — categories (for the Listbox), the
   * expense ledger (optionally windowed by `from` / `to` dates) and the
   * headline stats the Expenses page cards read.
   */
  static async expensesOverview({ from, to } = {}) {
    const categories = await this.categoryList();
    const gemini_model = await this.geminiModel();
    const references = await this.budgetReference();

    const where = [];
    const params = [];

    if (from) {
      params.push(from);
      where.push(`e.expense_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`e.expense_date <= $${params.length}::date`);
    }

    // `expense_date::text` keeps the wire format as "YYYY-MM-DD" — node-pg
    // would otherwise hand back a Date at local midnight, which JSON-serializes
    // to a UTC-shifted instant and can land on the previous day.
    const expenses = await query(
      `SELECT
          e.id,
          e.description,
          e.total_amount::float8 AS total_amount,
          e.expense_date::text AS expense_date,
          e.payment_method,
          e.status,
          e.notes,
          e.created_at,
          e.category_id,
          c.category_name,
          e.receipt_id,
          e.issued_ref_id,
          e.user_id,
          u.name AS created_by
       FROM expenses e
       LEFT JOIN category c ON c.category_id = e.category_id
       LEFT JOIN users u ON u.user_id = e.user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      params,
    );

    const stats = await query(
      `SELECT
          COALESCE(SUM(total_amount), 0)::float8 AS total_expenses,
          COALESCE(SUM(total_amount) FILTER (
            WHERE expense_date >= date_trunc('month', CURRENT_DATE)
          ), 0)::float8 AS this_month,
          COUNT(*)::int AS total_transactions
       FROM expenses
       WHERE status != 'cancel'`,
      [],
    );

    const s = stats.rows[0] ?? {};

    return {
      categories,
      references,
      gemini_model,
      expenses: expenses.rows,
      overview: {
        totalExpenses: Number(s.total_expenses) || 0,
        thisMonth: Number(s.this_month) || 0,
        totalTransactions: Number(s.total_transactions) || 0,
        totalCategories: categories.length,
      },
    };
  }
}

export default Expenses;
