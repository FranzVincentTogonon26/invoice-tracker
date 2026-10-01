import { query, withTransaction } from "../config/db.js";

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

    // Employee rows are excluded — their spend already left the reference as
    // `issued` (see referenceBalance below).
    const overviewExpenses = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(e.total_amount), 0) AS amount
       FROM expenses e
       JOIN budget_reference br ON br.reference_id = e.reference_id
       WHERE NOT EXISTS (
         SELECT 1 FROM users u
          WHERE u.user_id = e.user_id AND u.role = 'employee'
       )
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
    const totalExpenses = overviewExpenses.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    // Return `.rows` (not the raw pg result) so the API payload is a plain
    // array — the frontend consumes these directly.
    return {
      overviewBudget: overviewBudget.rows,
      overviewIssuedBudget: overviewIssuedBudget.rows,
      overviewExpenses: overviewExpenses.rows,
      totalBudget,
      totalIssued,
      totalExpenses,
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

  // Finds the reusable parent row for an issuance: the OPEN
  // `budget_issued_reference` for this exact employee + budget source, if one
  // exists. Same-reference top-ups reuse it so repeated issues never stack up
  // duplicate parent rows. Returns null when there is nothing to reuse (no row
  // yet, or only closed/cancelled rows) so the caller inserts a fresh parent.
  static async findOpenIssuedReference({ reference_id, user_id }) {
    const result = await query(
      `SELECT *
         FROM budget_issued_reference
        WHERE user_id = $1
          AND reference_id = $2
          AND status = 'open'
        ORDER BY created_at DESC
        LIMIT 1`,
      [user_id, reference_id],
    );
    return result.rows[0] ?? null;
  }

  // Atomically issues a budget to an employee without duplicating the parent
  // row: reuses the OPEN `budget_issued_reference` for this
  // (user_id, reference_id) pair when one exists, otherwise inserts it, then
  // inserts the `issued_budget` child row. The whole pair runs in ONE
  // transaction so a failed child insert can never orphan a parent row; the
  // re-select is locked (FOR UPDATE) and a partial unique index (migration
  // 003) plus the 23505-catch below keep two concurrent submits from both
  // inserting. Resolves `{ issuedReference, issuedBudget, reused }`.
  static async issueBudgetToEmployee({
    reference_id,
    user_id,
    amount,
    description,
    method,
    note,
  }) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      let issuedReference =
        (
          await q(
            `SELECT *
               FROM budget_issued_reference
              WHERE user_id = $1
                AND reference_id = $2
                AND status = 'open'
              ORDER BY created_at DESC
              LIMIT 1
              FOR UPDATE`,
            [user_id, reference_id],
          )
        ).rows[0] ?? null;
      let reused = Boolean(issuedReference);

      if (!issuedReference) {
        try {
          issuedReference =
            (
              await q(
                `INSERT INTO budget_issued_reference
                 (reference_id, user_id, date_cut_off)
               VALUES
                 ($1, $2, NOW() + INTERVAL '1 month')
               RETURNING *`,
                [reference_id, user_id],
              )
            ).rows[0] ?? null;
        } catch (err) {
          // Race lost: a concurrent submit inserted the OPEN row first and the
          // partial unique index (migration 003) rejected this insert with
          // 23505. Re-select the winner instead of failing. Any other error
          // (e.g. bad FK) still throws and rolls the transaction back.
          // On DBs that haven't run migration 003 yet there is no index to
          // collide with, so this branch simply never triggers — plain INSERT
          // (no ON CONFLICT clause) keeps working everywhere.
          if (err?.code !== "23505") throw err;
          issuedReference =
            (
              await q(
                `SELECT *
                   FROM budget_issued_reference
                  WHERE user_id = $1
                    AND reference_id = $2
                    AND status = 'open'
                  ORDER BY created_at DESC
                  LIMIT 1`,
                [user_id, reference_id],
              )
            ).rows[0] ?? null;
          reused = true;
        }

        if (!issuedReference)
          throw new Error("Could not resolve issued budget reference.");
      }

      const issuedBudget = (
        await q(
          `INSERT INTO issued_budget
             (issued_ref_id, amount, description, method, notes)
           VALUES
             ($1, $2, $3, $4, $5)
           RETURNING *`,
          [issuedReference.id, amount, description, method, note],
        )
      ).rows[0];

      return { issuedReference, issuedBudget, reused };
    });
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

  // Budget page — the "Employees" tab cards (AdminBudget > EmployeeBudget.jsx).
  // ONE ROW PER `issued_budget` TRANSACTION, reached through its parent via
  // `issued_budget.issued_ref_id = budget_issued_reference.id` — NOT one row
  // per `budget_issued_reference` parent. A same-source top-up reuses the
  // employee's OPEN parent row (migration 003), so counting parents showed
  // "1 budget" for an employee who had actually received 2+ issuances:
  // `group.budgets.length` in the card is the length of this row list.
  // Rows stay scoped to OPEN parents (money the employee currently holds) and
  // carry the source label so the card can group per reference. `total_amount`
  // is the single transaction's amount (the card sums it per label group) and
  // `recent_date` is the transaction's own date — the card keeps the MAX of
  // the rows it received, which equals the old MAX(i.created_at).
  static async employeesWithBudget() {
    const result = await query(
      `SELECT
          ib.id AS issued_budget_id,
          bir.id AS issued_ref_id,
          bir.user_id,
          u.name,
          br.reference_id,
          br.label,
          ib.amount::float8 AS total_amount,
          ib.created_at AS recent_date
       FROM budget_issued_reference bir
          LEFT JOIN users u
          ON bir.user_id = u.user_id
          LEFT JOIN budget_reference br
          ON br.reference_id = bir.reference_id
          JOIN issued_budget ib
          ON ib.issued_ref_id = bir.id
       WHERE bir.status = 'open'
       ORDER BY u.name ASC, ib.created_at DESC`,
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
  // - `expenses`:  SUM(expenses.total_amount) — funds already spent against
  //                this reference by saved expenses
  // - `balance`:   allocated - issued - expenses (what can still be issued),
  //                the same formula the AdminBudget overview uses.
  // Scalar subqueries with COALESCE keep empty references at 0 instead of NULL
  // (SUM returns NULL over zero rows).
  //
  // Employee expenses ARE tagged with their source reference now, but their
  // spend left the reference when it was issued — counting those rows here as
  // well would subtract them twice, so every admin-side expense sum below
  // (here and in expenses.model.js) skips rows owned by an employee.
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
            WHERE bir.status = 'open' AND bir.reference_id = $1
          ), 0) AS issued,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            WHERE e.reference_id = $1  AND e.status = 'paid'
              AND NOT EXISTS (
                SELECT 1 FROM users u
                 WHERE u.user_id = e.user_id AND u.role = 'employee'
              )
          ), 0) AS expenses`,
      [referenceId],
    );

    const row = result.rows[0] ?? { allocated: 0, issued: 0, expenses: 0 };
    const allocated = Number(row.allocated);
    const issued = Number(row.issued);
    const expenses = Number(row.expenses);
    return {
      allocated,
      issued,
      expenses,
      balance: allocated - issued - expenses,
    };
  }

  // Restriction guard for issuing budgets — an employee may only hold ONE open
  // issued budget reference at a time. Returns the employee's
  // `budget_issued_reference` rows that are still validated as status 'open',
  // joined to their source-of-funds label (budget_reference).
  // `reference_id` (the source being issued from) is excluded when provided:
  // issuing MORE funds from the same source is allowed — only a DIFFERENT
  // source of funds conflicts. Omit it to inspect every open issuance.
  static async employeeOpenIssuedReferences({ user_id, reference_id } = {}) {
    const params = [user_id];
    let excludeClause = "";

    if (reference_id) {
      params.push(reference_id);
      excludeClause = `AND bir.reference_id <> $2`;
    }

    const result = await query(
      `SELECT
          bir.id,
          bir.reference_id,
          bir.status,
          bir.created_at,
          br.label
       FROM budget_issued_reference bir
       LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
       WHERE bir.user_id = $1
         AND bir.status = 'open'
         ${excludeClause}
       ORDER BY bir.created_at DESC`,
      params,
    );
    return result.rows;
  }

  // Employee budget page — every `issued_budget` row the employee received
  // plus every successful `budget_transfer` they sent or received, reached
  // through THEIR OWN `budget_issued_reference` rows (scoped by
  // `user_id`, never a query param), joined to the source budget reference
  // label. Unlike the overview totals below, ALL statuses are returned so a
  // cancelled/closed issuance stays visible in the list with its status badge
  // (transfers are success-only: they complete or not at all).
  // Optional filter:
  //   - `search`: matched against description, notes, method and the source
  //     of funds label (ILIKE)
  static async employeeBudget(userId, { search } = {}) {
    // Overview mirrors employee.overview.model: the hero reads money the
    // employee still HOLDS (open issuances only) and the "Remaining" mini
    // stat reads the SAME balance the Overview page hero shows —
    // issued + OPEN abono − PAID expenses − sent transfers + received
    // transfers (only 'success' transfers move money; drafts/cancelled rows
    // never count as spent, and only an OPEN out-of-pocket top-up widens
    // what can still be spent — settled/draft abono never fund it).
    const overviewResult = await query(
      `SELECT
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
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            WHERE ea.user_id = $1 AND ea.status = 'open'
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            WHERE bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          COALESCE((
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = $1 AND btr.status = 'success'
          ), 0)::float8 AS total_received,
          COALESCE((
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            WHERE bir.user_id = $1 AND bir.status = 'open'
          ), 0)::int AS active_references`,
      [userId],
    );

    const txParams = [userId];
    let searchClause = "";
    if (search && search.trim()) {
      txParams.push(`%${search.trim()}%`);
      searchClause = `WHERE (t.description ILIKE $2
              OR t.notes ILIKE $2
              OR t.method ILIKE $2
              OR t.source_of_funds ILIKE $2
              OR t.counterparty ILIKE $2
              OR t.kind ILIKE $2
              OR t.direction ILIKE $2)`;
    }

    // `::float8` casts DECIMAL (returned by pg as strings) to a JS number.
    // The ledger merges the employee's `issued_budget` rows with their
    // `budget_transfer` rows (success only — transfers complete or not at
    // all, so there is no draft state to list): sent rows read
    // `direction = 'sent'` with the recipient as counterparty, received rows
    // read `direction = 'received'` with the sender as counterparty. All
    // three branches expose the same column shape positionally.
    const txResult = await query(
      `SELECT * FROM (
         SELECT
            ib.id,
            ib.issued_ref_id,
            bir.reference_id,
            br.label AS source_of_funds,
            'issued' AS kind,
            NULL AS direction,
            ib.description,
            ib.notes,
            ib.amount::float8 AS amount,
            ib.method,
            bir.status,
            bir.date_cut_off,
            NULL AS counterparty,
            ib.created_at AS date,
            ib.created_at AS created_at
           FROM budget_issued_reference bir
           JOIN issued_budget ib ON ib.issued_ref_id = bir.id
           LEFT JOIN budget_reference br ON br.reference_id = bir.reference_id
          WHERE bir.user_id = $1
        UNION ALL
         SELECT
            bt.id,
            NULL::uuid AS issued_ref_id,
            bt.reference_id,
            br.label AS source_of_funds,
            'transfer' AS kind,
            'sent' AS direction,
            COALESCE(
              NULLIF(TRIM(bt.notes), ''),
              'Budget transfer to ' || COALESCE(ru.name, 'employee')
            ) AS description,
            bt.notes,
            bt.amount::float8 AS amount,
            bt.method,
            bt.status,
            NULL::timestamptz AS date_cut_off,
            ru.name AS counterparty,
            bt.created_at AS date,
            bt.created_at AS created_at
           FROM budget_transfer bt
           LEFT JOIN budget_reference br ON br.reference_id = bt.reference_id
           LEFT JOIN users ru ON ru.user_id = bt.transfer_to
          WHERE bt.user_id = $1 AND bt.status = 'success'
        UNION ALL
         SELECT
            bt.id,
            NULL::uuid AS issued_ref_id,
            bt.reference_id,
            br.label AS source_of_funds,
            'transfer' AS kind,
            'received' AS direction,
            COALESCE(
              NULLIF(TRIM(bt.notes), ''),
              'Budget transfer from ' || COALESCE(su.name, 'employee')
            ) AS description,
            bt.notes,
            bt.amount::float8 AS amount,
            bt.method,
            bt.status,
            NULL::timestamptz AS date_cut_off,
            su.name AS counterparty,
            bt.created_at AS date,
            bt.created_at AS created_at
           FROM budget_transfer bt
           LEFT JOIN budget_reference br ON br.reference_id = bt.reference_id
           LEFT JOIN users su ON su.user_id = bt.user_id
          WHERE bt.transfer_to = $1 AND bt.status = 'success'
       ) t
       ${searchClause}
       ORDER BY t.created_at DESC`,
      txParams,
    );

    const row = overviewResult.rows[0] ?? {};
    const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
    const totalBudget = toMoney(row.total_budget);
    const totalExpenses = toMoney(row.total_expenses);
    const totalAbono = toMoney(row.total_abono);
    const totalSent = toMoney(row.total_sent);
    const totalReceived = toMoney(row.total_received);

    return {
      overview: {
        totalBudget,
        totalExpenses,
        totalAbono,
        totalSent,
        totalReceived,
        totalBalance: toMoney(
          totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
        ),
        activeReferences: Number(row.active_references) || 0,
      },
      transactions: txResult.rows,
    };
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

  // Budget Issued Transaction — every `issued_budget` row joined to its parent
  // `budget_issued_reference`, the receiving employee, and the source budget
  // reference label (shown as "Source of Funds").
  // Optional filter:
  //   - `search`: matched against employee name, description, notes and the
  //     reference label (ILIKE)
  // NOTE: `RETURNING` is only valid on INSERT/UPDATE/DELETE — this is a
  // SELECT, so the columns are selected directly and ALL rows are returned
  // (the UI renders a list, not a single row). `bib.*` / `ib.*` shorthand is
  // deliberately avoided: both tables share `id`, `notes` and `created_at`,
  // so the column names would collide in the result set.
  static async budgetIssuedTransaction({ search } = {}) {
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
    }

    const searchClause = params.length
      ? `WHERE (u.name ILIKE $1
              OR ib.description ILIKE $1
              OR ib.notes ILIKE $1
              OR br.label ILIKE $1)`
      : "";

    // `::float8` casts DECIMAL (returned by pg as strings) to a JS number.
    const result = await query(
      `SELECT
          ib.id,
          ib.issued_ref_id,
          bib.reference_id,
          br.label AS source_of_funds,
          u.user_id,
          u.name AS employee,
          u.role AS employee_role,
          u.avatar_url,
          ib.description,
          ib.notes,
          ib.amount::float8 AS amount,
          ib.method,
          ib.created_at AS date_issued,
          bib.status
       FROM budget_issued_reference bib
       JOIN issued_budget ib ON ib.issued_ref_id = bib.id
       JOIN users u ON u.user_id = bib.user_id
       LEFT JOIN budget_reference br ON br.reference_id = bib.reference_id
       ${searchClause}
       ORDER BY ib.created_at DESC`,
      params,
    );
    return result.rows;
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

  // Cancel an issued budget transaction — flips the parent
  // `budget_issued_reference.status` to 'cancel'. The UI row is keyed by
  // `issued_budget.id`, but the status lives on the reference it belongs to,
  // so the parent is resolved via `issued_ref_id` first. Returns the previous
  // status plus the updated reference row, or null when the id does not exist.
  static async cancelIssuedTransaction(id) {
    const existing = await query(
      `SELECT bir.id, bir.status
         FROM budget_issued_reference bir
         JOIN issued_budget ib ON ib.issued_ref_id = bir.id
        WHERE ib.id = $1`,
      [id],
    );
    const previous = existing.rows[0] ?? null;
    if (!previous) return null;

    const result = await query(
      `UPDATE budget_issued_reference
          SET status = 'cancel'
        WHERE id = $1
        RETURNING *`,
      [previous.id],
    );
    return { previousStatus: previous.status, issuedReference: result.rows[0] };
  }

  // Undo an issued cancellation — restores the parent reference to its
  // previous status ('open'). Accepts the same `issued_budget.id` and resolves
  // the parent reference before updating.
  static async restoreIssuedTransaction(id, status) {
    const existing = await query(
      `SELECT bir.id
         FROM budget_issued_reference bir
         JOIN issued_budget ib ON ib.issued_ref_id = bir.id
        WHERE ib.id = $1`,
      [id],
    );
    const reference = existing.rows[0] ?? null;
    if (!reference) return null;

    const result = await query(
      `UPDATE budget_issued_reference
          SET status = $2
        WHERE id = $1
        RETURNING *`,
      [reference.id, status],
    );
    return result.rows[0] ?? null;
  }
}

export default Budget;
