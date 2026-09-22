import { query, withTransaction } from "../config/db.js";

// receipt.qty is INTEGER in the schema, but scanned lines (Gemini / manual
// entry) can carry fractional quantities like 3.62 — round them so the insert
// doesn't fail with `invalid input syntax for type integer` (pg 22P02).
const toIntQty = (value, fallback = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
};

class Expenses {
  static CATEGORY_COLUMNS = "category_id, category_name, created_at";

  static async categoryList() {
    // `expense_count` reports how many expense rows reference each category so
    // the UI can lock its delete action (deleting a category would null out
    // expenses.category_id through ON DELETE SET NULL).
    const result = await query(
      `SELECT c.category_id,
              c.category_name,
              c.created_at,
              COUNT(e.id)::int AS expense_count
         FROM category c
         LEFT JOIN expenses e ON e.category_id = c.category_id
        GROUP BY c.category_id, c.category_name, c.created_at
        ORDER BY c.category_name ASC`,
      [],
    );
    return result.rows;
  }

  static async geminiModel() {
    const result = await query(
      `SELECT id, model
         FROM geminimodel
        ORDER BY model ASC`,
      [],
    );
    return result.rows;
  }

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

  static async removeCategory(id) {
    const result = await query(
      `DELETE FROM category
        WHERE category_id = $1
        RETURNING ${this.CATEGORY_COLUMNS}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  static async createReceipt({
    receipt_id = null,
    vendor = null,
    description = null,
    qty = 1,
    rate = 0,
    amount = 0,
    items = [],
  }) {
    const lines =
      Array.isArray(items) && items.length > 0
        ? items
        : [{ description, qty, rate, amount }];

    const rows = [];
    for (const line of lines) {
      const result = await query(
        `INSERT INTO receipt
           (receipt_id, vendor, description, qty, rate, amount)
         VALUES (COALESCE($1::text, gen_random_uuid()::text), $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          receipt_id,
          vendor || null,
          line.description ?? null,
          toIntQty(line.qty),
          line.rate ?? 0,
          line.amount ?? 0,
        ],
      );
      rows.push(result.rows[0]);
    }
    return rows;
  }

  static async upsertReceipt(client, draft) {
    await client.query(`DELETE FROM receipt WHERE receipt_id = $1`, [
      draft.receipt_id,
    ]);

    return this.insertReceiptRows(client, draft);
  }

  static async insertReceiptRows(client, draft) {
    const lines =
      Array.isArray(draft.items) && draft.items.length > 0
        ? draft.items
        : [
            {
              description: draft.description,
              qty: draft.qty,
              rate: draft.rate,
              amount: draft.amount,
            },
          ];

    const rows = [];
    for (const line of lines) {
      const result = await client.query(
        `INSERT INTO receipt
           (receipt_id, vendor, description, qty, rate, amount)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          draft.receipt_id,
          draft.vendor || null,
          line.description ?? null,
          toIntQty(line.qty),
          line.rate ?? 0,
          line.amount ?? 0,
        ],
      );
      rows.push(result.rows[0]);
    }
    return rows;
  }

  static async createExpenses({
    items,
    user_id,
    issued_ref_id = null,
    reference_id = null,
    receipts = [],
    image_url = null,
    receipt_date = null,
  }) {
    return withTransaction(async (client) => {
      const receiptRowIds = new Map();

      for (const draft of receipts) {
        if (!draft?.receipt_id) continue;
        const rows = await this.upsertReceipt(client, draft);
        receiptRowIds.set(draft.receipt_id, rows[0]?.id ?? null);
      }

      const unresolved = [
        ...new Set(
          items
            .map((item) => item.receipt_id)
            .filter((id) => id && !receiptRowIds.has(id)),
        ),
      ];

      if (unresolved.length > 0) {
        const found = await client.query(
          `SELECT DISTINCT ON (receipt_id) receipt_id, id
             FROM receipt
            WHERE receipt_id = ANY($1::text[])
            ORDER BY receipt_id, created_at ASC`,
          [unresolved],
        );
        for (const row of found.rows) {
          receiptRowIds.set(row.receipt_id, row.id);
        }
      }

      const rows = [];

      for (const item of items) {
        const storedReceiptId = item.receipt_id
          ? (receiptRowIds.get(item.receipt_id) ?? null)
          : null;

        const result = await client.query(
          `INSERT INTO expenses
             (user_id, issued_ref_id, reference_id, description, category_id,
              total_amount, expense_date, notes, receipt_id, payment_method,
              image_url, receipt_date)
           VALUES
             ($1, $2, COALESCE($3::uuid, $11::uuid), $4, $5, $6,
              COALESCE($7::date, CURRENT_DATE), $8, $9, $10, $12, $13)
           RETURNING *`,
          [
            user_id,
            issued_ref_id,
            reference_id ?? null,
            item.description,
            item.category_id ?? null,
            item.total_amount ?? 0,
            item.expense_date ?? null,
            item.notes ?? null,
            storedReceiptId,
            item.payment_method ?? "cash",
            item.reference_id ?? null,
            item.image_url ?? image_url ?? null,
            item.receipt_date ?? receipt_date ?? null,
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
          ), 0)::float8 AS issued,
          COALESCE((
            SELECT SUM(e.total_amount)
              FROM expenses e
             WHERE e.reference_id = b.reference_id
               AND e.status != 'cancel'
          ), 0)::float8 AS expenses
         FROM budget_reference b
        WHERE b.status = 'open'
        ORDER BY b.created_at DESC`,
      [],
    );

    return result.rows.map((row) => {
      const allocated = Number(row.allocated) || 0;
      const issued = Number(row.issued) || 0;
      const expenses = Number(row.expenses) || 0;
      // Spendable balance mirrors the AdminBudget overview:
      // allocated − issued − expenses (expenses drawn against this source
      // reduce what the Add Expenses form can still fund).
      return {
        ...row,
        allocated,
        issued,
        expenses,
        balance: allocated - issued - expenses,
      };
    });
  }

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
          u.name AS created_by,
          u.role AS created_by_role,
          u.avatar_url AS created_by_avatar
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

    const overviewExpenses = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(e.total_amount), 0) AS amount
       FROM expenses e
       JOIN budget_reference br ON br.reference_id = e.reference_id
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // Scalar count — the previous query mixed COUNT with GROUP BY/ORDER BY,
    // which returned a raw pg result object instead of a single number.
    const totalTransaction = await query(
      `SELECT COUNT(e.id)::int AS total
         FROM expenses e
         JOIN budget_reference br ON br.reference_id = e.reference_id`,
      [],
    );

    const s = stats.rows[0] ?? {};

    // pg returns DECIMAL as strings — cast before summing.
    const totalBudget = overviewBudget.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const totalIssued = overviewIssuedBudget.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const totalExpenses = overviewExpenses.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    return {
      categories,
      references,
      gemini_model,
      expenses: expenses.rows,
      overview: {
        overviewBudget: overviewBudget.rows,
        overviewIssuedBudget: overviewIssuedBudget.rows,
        overviewExpenses: overviewExpenses.rows,
        totalBudget,
        totalIssued,
        totalExpenses,
        totalCategories: categories.length,
        totalTransaction: totalTransaction.rows[0]?.total ?? 0,
      },
    };
  }
}

export default Expenses;
