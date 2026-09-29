import { query } from "../config/db.js";

// Round to centavos so a fully-spent balance reads exactly 0 instead of a
// floating-point residue (same helper the expenses model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// The row shape every endpoint hands back — DECIMAL amount cast to float8 so
// the client never parses a string, plus the source-of-funds label the
// ledger / details portal display.
const ABONO_COLUMNS = `
    ea.id,
    ea.reference_id,
    ea.user_id,
    ea.amount::float8 AS amount,
    ea.description,
    ea.status,
    ea.date_settled,
    ea.created_at,
    ea.updated_at,
    br.label AS reference_label`;

// employee_abono access — every employee-facing read is scoped by the
// `user_id` the auth middleware resolved from the token, never a query param.
class Abono {
  // One employee's abono rows, newest first — the list the Abono page renders.
  static async listByUser(userId) {
    const result = await query(
      `SELECT ${ABONO_COLUMNS}
         FROM employee_abono ea
         LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
        WHERE ea.user_id = $1
        ORDER BY ea.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  // Admin list: every abono row across employees (the GET /abono endpoint),
  // optionally filtered by search against the description, employee name and
  // source-of-funds label — same ILIKE style as the other admin ledgers.
  static async listAll({ search } = {}) {
    const params = [];
    let where = "";
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where = `WHERE (ea.description ILIKE $1
                    OR u.name ILIKE $1
                    OR br.label ILIKE $1)`;
    }

    const result = await query(
      `SELECT ${ABONO_COLUMNS},
              u.name AS employee_name,
              u.email AS employee_email
         FROM employee_abono ea
         LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
         LEFT JOIN users u ON u.user_id = ea.user_id
         ${where}
        ORDER BY ea.created_at DESC`,
      params,
    );
    return result.rows;
  }

  // The Abono page hero + mini stats. Money rules mirror
  // employee.overview.model: totalBalance = open issuances + OPEN abono −
  // PAID expenses, so an out-of-pocket top-up immediately widens what the
  // employee can spend while a settled/draft row never funds it.
  static async employeeAbonoOverview(userId) {
    const [abono, statsResult] = await Promise.all([
      this.listByUser(userId),
      query(
        `SELECT
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
              SELECT SUM(ib.amount)
                FROM budget_issued_reference bir
                JOIN issued_budget ib ON ib.issued_ref_id = bir.id
               WHERE bir.user_id = $1 AND bir.status = 'open'
            ), 0)::float8 AS total_budget,
            COALESCE((
              SELECT SUM(e.total_amount)
                FROM expenses e
               WHERE e.user_id = $1 AND e.status = 'paid'
            ), 0)::float8 AS total_expenses`,
        [userId],
      ),
    ]);

    const s = statsResult.rows[0] ?? {};
    const totalBudget = toMoney(s.total_budget);
    const totalAbono = toMoney(s.total_abono);
    const totalExpenses = toMoney(s.total_expenses);

    return {
      abono,
      overview: {
        totalAbono,
        totalBudget,
        totalExpenses,
        totalBalance: toMoney(totalBudget + totalAbono - totalExpenses),
        abonoCount: Number(s.abono_count) || 0,
      },
    };
  }

  // Default source of funds for a new abono: the employee's OLDEST open
  // issuance — the same "oldest-funding-first" order employeeReferenceList
  // uses to credit untagged abono, so create and reporting always agree.
  static async defaultReferenceForUser(userId) {
    const result = await query(
      `SELECT bir.reference_id, br.label
         FROM budget_issued_reference bir
         LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
        WHERE bir.user_id = $1 AND bir.status = 'open'
        ORDER BY bir.created_at ASC, br.created_at ASC
        LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  // Guard for an explicitly passed reference_id — an employee may only book
  // abono against a source they currently hold as an open issuance.
  static async holdsOpenReference(userId, referenceId) {
    const result = await query(
      `SELECT 1
         FROM budget_issued_reference
        WHERE user_id = $1 AND reference_id = $2 AND status = 'open'
        LIMIT 1`,
      [userId, referenceId],
    );
    return result.rowCount > 0;
  }

  static async create({ user_id, reference_id, amount, description }) {
    const result = await query(
      `INSERT INTO employee_abono (reference_id, user_id, amount, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reference_id, user_id, amount::float8 AS amount,
                 description, status, date_settled, created_at, updated_at`,
      [reference_id, user_id, amount, description],
    );
    return result.rows[0];
  }

  // Row lookup for the single-row endpoints (update description / delete).
  // Ownership is enforced in the controller — same pattern as
  // Expenses.findExpenseById + canTouchRow.
  static async findById(id) {
    const result = await query(
      `SELECT ${ABONO_COLUMNS}
         FROM employee_abono ea
         LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
        WHERE ea.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  static async updateDescription(id, description) {
    const result = await query(
      `UPDATE employee_abono
          SET description = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, reference_id, user_id, amount::float8 AS amount,
                  description, status, date_settled, created_at, updated_at`,
      [id, description],
    );
    return result.rows[0] ?? null;
  }

  static async remove(id) {
    const result = await query(
      `DELETE FROM employee_abono
        WHERE id = $1
        RETURNING id`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}

export default Abono;
