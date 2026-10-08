import { query, withTransaction } from "../config/db.js";

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
  // Closed sources leave no footsteps: rows booked to a cut-off source never
  // list (`reference_id` is NOT NULL, so the inner condition is safe).
  static async listByUser(userId) {
    const result = await query(
      `SELECT ${ABONO_COLUMNS}
         FROM employee_abono ea
         LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
        WHERE ea.user_id = $1
          AND br.status = 'open'
        ORDER BY ea.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  // Admin list: every abono row across employees (the GET /abono endpoint),
  // optionally filtered by search against the description, employee name and
  // source-of-funds label — same ILIKE style as the other admin ledgers.
  // Closed sources leave no footsteps here either.
  static async listAll({ search } = {}) {
    const params = [];
    let where = "br.status = 'open'";
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where = `(${where}) AND (ea.description ILIKE $1
                    OR u.name ILIKE $1
                    OR br.label ILIKE $1)`;
    }

    const result = await query(
      `SELECT ${ABONO_COLUMNS},
              u.name AS employee_name,
              u.email AS employee_email,
              u.avatar_url AS employee_avatar
         FROM employee_abono ea
         LEFT JOIN budget_reference br ON br.reference_id = ea.reference_id
         LEFT JOIN users u ON u.user_id = ea.user_id
        ${where ? `WHERE ${where}` : ""}
        ORDER BY ea.created_at DESC`,
      params,
    );
    return result.rows;
  }

  // The Abono page hero + mini stats. Money rules mirror
  // employee.overview.model: totalBalance = open issuances + OPEN abono −
  // PAID expenses − sent transfers + received transfers, so an out-of-pocket
  // top-up immediately widens what the employee can spend while a
  // settled/draft row never funds it. Only 'success' transfers move money.
  static async employeeAbonoOverview(userId) {
    const [abono, statsResult] = await Promise.all([
      this.listByUser(userId),
      query(
        `SELECT
            COALESCE((
              SELECT SUM(ea.amount)
                FROM employee_abono ea
                JOIN budget_reference br ON br.reference_id = ea.reference_id
               WHERE ea.user_id = $1 AND ea.status = 'open'
                 AND br.status = 'open'
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
                 AND ib.status != 'cancel'
            ), 0)::float8 AS total_budget,
            COALESCE((
              SELECT SUM(e.total_amount)
                 FROM expenses e
                WHERE e.user_id = $1 AND e.status = 'paid'
             ), 0)::float8 AS total_expenses,
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
      ),
    ]);

    const s = statsResult.rows[0] ?? {};
    const totalBudget = toMoney(s.total_budget);
    const totalAbono = toMoney(s.total_abono);
    const totalExpenses = toMoney(s.total_expenses);
    const totalSent = toMoney(s.total_sent);
    const totalReceived = toMoney(s.total_received);

    return {
      abono,
      overview: {
        totalAbono,
        totalBudget,
        totalExpenses,
        totalSent,
        totalReceived,
        totalBalance: toMoney(
          totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
        ),
        abonoCount: Number(s.abono_count) || 0,
      },
    };
  }

  // Settle Abono — flips every OPEN row the employee checked to 'settled' and
  // stamps `date_settled = NOW()`. One transaction:
  //   1. lock + re-read the requested rows, scoped to the employee's user_id
  //      and keeping only rows still in status 'open' (the ledger may have
  //      moved since the dialog loaded)
  //   2. re-apply the money rule: settling takes those amounts OUT of the
  //      spendable pool (open issuances + OPEN abono − PAID expenses), so a
  //      request the remaining balance can't cover must fail BEFORE any write.
  //      Resolved as `insufficient: true` — the controller answers with the
  //      400 notice; nothing is committed.
  //   3. update only the still-open rows and hand them back.
  // Resolves `{ insufficient, requested, totalBalance, settled }`.
  static async settleOpen(userId, ids) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      // `FOR UPDATE` holds these rows for the rest of the transaction, so a
      // parallel settle / delete can't interleave between read and write.
      const locked = await q(
        `SELECT id, amount::float8 AS amount
           FROM employee_abono
          WHERE user_id = $1
            AND id = ANY($2::uuid[])
            AND status = 'open'
          FOR UPDATE`,
        [userId, ids],
      );

      // Nothing still open → nothing to settle, no writes, no balance read.
      if (locked.rows.length === 0) {
        return {
          insufficient: false,
          requested: 0,
          totalBalance: null,
          settled: [],
        };
      }

      const requested = toMoney(
        locked.rows.reduce((sum, row) => sum + Number(row.amount), 0),
      );

      // Same money rules every overview model uses (employee.overview.model):
      // what the employee can still spend right now, counting OPEN abono
      // only, minus sent transfers plus received transfers (success only).
      const balance = (
        await q(
          `SELECT
              COALESCE((
                SELECT SUM(ib.amount)
                FROM budget_issued_reference bir
                JOIN issued_budget ib ON ib.issued_ref_id = bir.id
                WHERE bir.user_id = $1 AND bir.status = 'open'
                  AND ib.status != 'cancel'
              ), 0)::float8
              + COALESCE((
                SELECT SUM(ea.amount)
                FROM employee_abono ea
                WHERE ea.user_id = $1 AND ea.status = 'open'
              ), 0)::float8
              - COALESCE((
                SELECT SUM(e.total_amount)
                FROM expenses e
                WHERE e.user_id = $1 AND e.status = 'paid'
              ), 0)::float8
              - COALESCE((
                SELECT SUM(bt.amount)
                FROM budget_transfer bt
                WHERE bt.user_id = $1 AND bt.status = 'success'
              ), 0)::float8
              + COALESCE((
                SELECT SUM(btr.amount)
                FROM budget_transfer btr
                WHERE btr.transfer_to = $1 AND btr.status = 'success'
              ), 0)::float8 AS total_balance`,
          [userId],
        )
      ).rows[0];
      const totalBalance = toMoney(balance?.total_balance);

      if (requested > totalBalance) {
        // No writes happened — the transaction commits an empty change set.
        return { insufficient: true, requested, totalBalance, settled: [] };
      }

      const settled = (
        await q(
          `UPDATE employee_abono
              SET status = 'settled',
                  date_settled = NOW(),
                  updated_at = NOW()
            WHERE user_id = $1
              AND id = ANY($2::uuid[])
              AND status = 'open'
            RETURNING id, reference_id, user_id, amount::float8 AS amount,
                      description, status, date_settled, created_at, updated_at`,
          [userId, ids],
        )
      ).rows;

      return { insufficient: false, requested, totalBalance, settled };
    });
  }

  // Default source of funds for a new abono: the employee's OLDEST open
  // issuance — the same "oldest-funding-first" order employeeReferenceList
  // uses to credit untagged abono, so create and reporting always agree.
  // Cut-off sources never qualify: abono can't be booked against a
  // disconnected source.
  static async defaultReferenceForUser(userId) {
    const result = await query(
      `SELECT bir.reference_id, br.label
         FROM budget_issued_reference bir
         LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
        WHERE bir.user_id = $1 AND bir.status = 'open'
          AND br.status = 'open'
        ORDER BY bir.created_at ASC, br.created_at ASC
        LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  // Guard for an explicitly passed reference_id — an employee may only book
  // abono against a source they currently hold as an open issuance AND whose
  // source itself is still open.
  static async holdsOpenReference(userId, referenceId) {
    const result = await query(
      `SELECT 1
         FROM budget_issued_reference bir
         JOIN budget_reference br ON br.reference_id = bir.reference_id
        WHERE bir.user_id = $1 AND bir.reference_id = $2 AND bir.status = 'open'
          AND br.status = 'open'
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

  // Spendable balance for one employee — the same money rule every overview
  // model uses: open issuances + OPEN abono − PAID expenses − sent transfers
  // + received transfers (success only). Deleting (like settling) takes an
  // OPEN abono OUT of this pool, so a delete whose amount the balance can't
  // cover means the money is already spent.
  static async spendableBalance(userId) {
    // Closed sources leave no footsteps: holdings, abono and spend tied to
    // a cut-off source never enter the pool (untagged expenses connect to
    // no source and still count).
    const result = await query(
      `SELECT
          COALESCE((
            SELECT SUM(ib.amount)
              FROM budget_issued_reference bir
              JOIN issued_budget ib ON ib.issued_ref_id = bir.id
              JOIN budget_reference br ON br.reference_id = bir.reference_id
             WHERE bir.user_id = $1 AND bir.status = 'open'
               AND br.status = 'open'
               AND ib.status != 'cancel'
          ), 0)::float8
          + COALESCE((
            SELECT SUM(ea.amount)
              FROM employee_abono ea
              JOIN budget_reference br ON br.reference_id = ea.reference_id
             WHERE ea.user_id = $1 AND ea.status = 'open'
               AND br.status = 'open'
          ), 0)::float8
          - COALESCE((
            SELECT SUM(e.total_amount)
              FROM expenses e
              LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
             WHERE e.user_id = $1 AND e.status = 'paid'
               AND (e.reference_id IS NULL OR br.status = 'open')
          ), 0)::float8
          - COALESCE((
            SELECT SUM(bt.amount)
              FROM budget_transfer bt
             WHERE bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8
          + COALESCE((
            SELECT SUM(btr.amount)
              FROM budget_transfer btr
             WHERE btr.transfer_to = $1 AND btr.status = 'success'
          ), 0)::float8 AS total_balance`,
      [userId],
    );
    return toMoney(result.rows[0]?.total_balance);
  }
}

export default Abono;
