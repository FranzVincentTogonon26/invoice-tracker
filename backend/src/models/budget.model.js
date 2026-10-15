import { query, withTransaction } from "../config/db.js";

// Round to centavos (same helper every other model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

class Budget {
  // Budget Overview

  static async budgetOverview() {
    // Closed sources leave no footsteps: every leg joins its
    // budget_reference with `br.status = 'open'`, so a cut-off source and
    // everything under it vanish from display AND from the totals.
    // Every OPEN reference lists — even with zero (or only cancelled)
    // allocations: the cancelled filter lives in the JOIN, not the WHERE,
    // so the LEFT JOIN stays a real outer join and empty references read 0
    // instead of vanishing. The page wires each reference to its related
    // issuances/expenses (zero-filled when none) for the per-source
    // remaining breakdown.
    const overviewBudget = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(b.amount), 0) AS amount
       FROM budget_reference br
       LEFT JOIN budget b ON b.reference_id = br.reference_id
         AND b.status != 'cancelled'
       WHERE br.status = 'open'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // Issued transactions list whether their holding is open OR closed —
    // only the source gates them (`budget_reference.status = 'open'`) plus
    // live children (`issued_budget.status != 'cancel'`). A finalized
    // (closed) holding's handed-out budget still counts as issued.
    const overviewIssuedBudget = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(i.amount), 0) AS amount
       FROM budget_issued_reference bir
       JOIN issued_budget i ON i.issued_ref_id = bir.id
       JOIN budget_reference br ON br.reference_id = bir.reference_id
       WHERE br.status = 'open'
         AND i.status != 'cancel'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // Forwarded leftovers handed back by finalized holdings (`status =
    // 'close') under open sources — spendable again. Every OPEN reference
    // lists (0 when nothing was forwarded). Added back into remaining
    // wherever issued counts closed holdings too, so finalized money is
    // never subtracted without its handover being added back.
    const overviewForwarded = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(bir.balance_forwarded), 0) AS amount
       FROM budget_reference br
       LEFT JOIN budget_issued_reference bir ON bir.reference_id = br.reference_id
         AND bir.status = 'close'
       WHERE br.status = 'open'
       GROUP BY br.reference_id, br.label, br.created_at
       ORDER BY br.created_at DESC`,
      [],
    );

    // Employee rows are excluded — their spend already left the reference as
    // `issued` (see referenceBalance below).
    // Display-only mirror for the page: the same per-source sums for
    // EMPLOYEE-authored rows. These never enter `totalExpenses` (that would
    // double-subtract against `issued`) — they only render as extra
    // breakdown rows so every source's employee spend stays visible.
    const overviewEmployeeExpenses = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.created_at,
          COALESCE(SUM(e.total_amount), 0) AS amount
       FROM budget_reference br
       LEFT JOIN expenses e ON e.reference_id = br.reference_id
         AND e.status = 'paid'
         AND EXISTS (
          SELECT 1 FROM users u
           WHERE u.user_id = e.user_id AND u.role = 'employee'
        )
       WHERE br.status = 'open'
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
       WHERE br.status = 'open'
         AND NOT EXISTS (
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
    const totalForwarded = overviewForwarded.rows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    // Return `.rows` (not the raw pg result) so the API payload is a plain
    // array — the frontend consumes these directly.
    return {
      overviewBudget: overviewBudget.rows,
      overviewIssuedBudget: overviewIssuedBudget.rows,
      overviewExpenses: overviewExpenses.rows,
      overviewEmployeeExpenses: overviewEmployeeExpenses.rows,
      overviewForwarded: overviewForwarded.rows,
      totalBudget,
      totalIssued,
      totalExpenses,
      totalForwarded,
    };
  }

  // Create Budget Reference
  // `reference_id` is intentionally omitted from the INSERT so the column's
  // `DEFAULT gen_random_uuid()` applies — inserting an explicit NULL would
  // violate the NOT NULL constraint (defaults don't fire for explicit NULLs).
  // `notes` is optional context shown on the Source of Funds page.
  static async createReferenceBudget({ label, notes = null, date_cut_off = null }) {
    const trimmedNotes = String(notes ?? "").trim();
    const result = await query(
      `INSERT INTO budget_reference (label, notes, date_cut_off)
       VALUES ($1, $2, $3::timestamptz)
       RETURNING *`,
      [label, trimmedNotes === "" ? null : trimmedNotes, date_cut_off],
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
    image_url = null,
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
             (issued_ref_id, amount, description, method, notes, image_url)
           VALUES
             ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [issuedReference.id, amount, description, method, note, image_url],
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
    // Closed sources leave no footsteps: holdings under a cut-off source
    // never surface here, so employees connected only through one disappear
    // from display entirely.
    const result = await query(
      `SELECT
          ib.id AS issued_budget_id,
          bir.id AS issued_ref_id,
          bir.user_id,
          u.name,
          u.avatar_url,
          br.reference_id,
          br.label,
          ib.amount::float8 AS total_amount,
          ib.created_at AS recent_date
       FROM budget_issued_reference bir
          LEFT JOIN users u
          ON bir.user_id = u.user_id
          JOIN budget_reference br
          ON br.reference_id = bir.reference_id
          AND br.status = 'open'
           JOIN issued_budget ib
           ON ib.issued_ref_id = bir.id
           AND ib.status != 'cancel'
        WHERE bir.status = 'open'
        ORDER BY u.name ASC, ib.created_at DESC`,
      [],
    );

    return result.rows;
  }

  // Source-of-funds gate: a budget reference only connects transactions
  // while its status is 'open'. Anything else ('cut_off', …) disconnects it
  // from every flow — writes must refuse it and pickers must not list it.
  static async isReferenceOpen(reference_id) {
    if (!reference_id) return false;
    const result = await query(
      `SELECT status FROM budget_reference WHERE reference_id = $1`,
      [reference_id],
    );
    return (result.rows[0]?.status ?? null) === "open";
  }

  // Cut-off date check for the addBudget gate: true when the reference
  // carries a cut-off date earlier than today (day granularity). A past
  // cut-off freezes new funds even while the status is still 'open'.
  static async isReferenceCutOffDue(reference_id) {
    if (!reference_id) return false;
    const result = await query(
      `SELECT date_cut_off FROM budget_reference WHERE reference_id = $1`,
      [reference_id],
    );
    const raw = result.rows[0]?.date_cut_off ?? null;
    if (!raw) return false;
    const day = new Date(raw);
    if (Number.isNaN(day.getTime())) return false;
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day < today;
  }

  // Source of Funds management list — EVERY reference (open AND cut-off),
  // each with its live aggregates, newest first. Unlike the picker lists,
  // management must also see disconnected sources to edit, reopen or
  // delete them — the `status` column drives those decisions.
  // Per source: allocated (non-cancelled budget rows), issued (open
  // issuances), expenses (paid, non-employee — employee spend already left
  // as `issued`), remaining = allocated − issued − expenses + forwarded
  // (finalized holdings hand their leftover back — the same formula as
  // AdminBudget's per-source Remaining breakdown), transactions (total
  // ledger records: budget + issued + expenses + abono + both transfer
  // legs — the overview's record badge with no filters), budgets (budget
  // rows).
  static async sourceFunds({ search, referenceId } = {}) {
    const params = [];
    let searchClause = "";
    if (referenceId) {
      params.push(referenceId);
      searchClause += ` AND br.reference_id = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      searchClause += ` AND (br.label ILIKE $${params.length} OR br.notes ILIKE $${params.length})`;
    }
    const result = await query(
      `SELECT
          br.reference_id,
          br.label,
          br.notes,
          br.status,
          br.date_cut_off,
          br.created_at,

          COALESCE((
            SELECT SUM(b.amount)
              FROM budget b
             WHERE b.reference_id = br.reference_id
               AND b.status != 'cancelled'
          ), 0)::float8 AS allocated,
          COALESCE((
            -- Same legs as AdminBudget's per-source Remaining breakdown
            -- (overviewIssuedBudget / overviewExpenses): open AND closed
            -- holdings count and expenses of any status count — only live
            -- children and non-employee rows qualify — so this table reads
            -- the same remaining for each source.
              SELECT SUM(ib.amount)
                 FROM budget_issued_reference bir
                 JOIN issued_budget ib ON ib.issued_ref_id = bir.id
                WHERE bir.reference_id = br.reference_id
                  AND ib.status != 'cancel'
             ), 0)::float8 AS issued,
          COALESCE((
            SELECT SUM(e.total_amount)
              FROM expenses e
             WHERE e.reference_id = br.reference_id
               AND NOT EXISTS (
                 SELECT 1 FROM users u
                  WHERE u.user_id = e.user_id AND u.role = 'employee'
               )
          ), 0)::float8 AS expenses,
          COALESCE((
            -- Employee spend tagged to this source (display-only: it
            -- already left the reference as issued, so it must NOT enter
            -- the remaining math — shown so each source accounts ALL of
            -- its expenses).
            SELECT SUM(e.total_amount)
              FROM expenses e
             WHERE e.reference_id = br.reference_id
               AND e.status = 'paid'
               AND EXISTS (
                 SELECT 1 FROM users u
                  WHERE u.user_id = e.user_id AND u.role = 'employee'
               )
          ), 0)::float8 AS employee_expenses,
          COALESCE((
            -- Settled abono tagged to this source (display-only, same
            -- reason as above — shown so the spent cell totals everything).
            SELECT SUM(ea.amount)
              FROM employee_abono ea
             WHERE ea.reference_id = br.reference_id
               AND ea.status = 'settled'
          ), 0)::float8 AS settled_abono,
          COALESCE((
            -- Finalized holdings hand their leftover back (same leg as
            -- AdminBudget's overviewForwarded).
            SELECT SUM(bir.balance_forwarded)
              FROM budget_issued_reference bir
             WHERE bir.reference_id = br.reference_id
               AND bir.status = 'close'
          ), 0)::float8 AS forwarded,
          (
            -- Total ledger records for this source — the same rows the
            -- overview's Related Transactions ledger lists (budget + issued
            -- + expenses + abono + both transfer legs), so the table's Txns
            -- cell matches the overview's record badge with no filters.
            COALESCE((
              SELECT COUNT(*)::int
                FROM budget b
               WHERE b.reference_id = br.reference_id
            ), 0) +
            COALESCE((
              SELECT COUNT(*)::int
                FROM budget_issued_reference bir
                JOIN issued_budget ib ON ib.issued_ref_id = bir.id
               WHERE bir.reference_id = br.reference_id
            ), 0) +
            COALESCE((
              SELECT COUNT(*)::int
                FROM expenses e
               WHERE e.reference_id = br.reference_id
            ), 0) +
            COALESCE((
              SELECT COUNT(*)::int
                FROM employee_abono ea
               WHERE ea.reference_id = br.reference_id
            ), 0) +
            COALESCE((
              SELECT COUNT(*)::int * 2
                FROM budget_transfer bt
               WHERE bt.reference_id = br.reference_id
            ), 0)
          ) AS transactions,
          (
            SELECT COUNT(*)::int
              FROM expenses e
             WHERE e.reference_id = br.reference_id
          ) AS expenses_count,
          (
            SELECT COUNT(*)::int
              FROM budget b
             WHERE b.reference_id = br.reference_id
          ) AS budgets,
          -- People involved with this source: every distinct account behind
          -- its issuances, expenses, abono and transfers (employees AND
          -- admins), with avatar + role for identity display. Capped list
          -- plus a total count for the "+N more" overflow.
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'user_id', p.user_id,
                  'name', p.name,
                  'avatar_url', p.avatar_url,
                  'role', p.role
                )
                ORDER BY p.name
              )
              FILTER (WHERE p.rn <= 6),
              '[]'
            )
            FROM (
              SELECT u.user_id, u.name, u.avatar_url, u.role,
                     ROW_NUMBER() OVER (ORDER BY u.name) AS rn
                FROM users u
               WHERE u.user_id IN (
                      SELECT bir.user_id
                        FROM budget_issued_reference bir
                       WHERE bir.reference_id = br.reference_id
                       UNION
                      SELECT e.user_id
                        FROM expenses e
                       WHERE e.reference_id = br.reference_id
                       UNION
                      SELECT ea.user_id
                        FROM employee_abono ea
                       WHERE ea.reference_id = br.reference_id
                       UNION
                      SELECT bt.user_id
                        FROM budget_transfer bt
                       WHERE bt.reference_id = br.reference_id
                       UNION
                      SELECT btr.transfer_to
                        FROM budget_transfer btr
                       WHERE btr.reference_id = br.reference_id
                     )
            ) p
          ) AS involved,
          (
            SELECT COUNT(*)::int
              FROM (
                SELECT bir.user_id
                  FROM budget_issued_reference bir
                 WHERE bir.reference_id = br.reference_id
                 UNION
                SELECT e.user_id
                  FROM expenses e
                 WHERE e.reference_id = br.reference_id
                 UNION
                SELECT ea.user_id
                  FROM employee_abono ea
                 WHERE ea.reference_id = br.reference_id
                 UNION
                SELECT bt.user_id
                  FROM budget_transfer bt
                 WHERE bt.reference_id = br.reference_id
                 UNION
                SELECT btr.transfer_to
                  FROM budget_transfer btr
                 WHERE btr.reference_id = br.reference_id
              ) people
          ) AS involved_count
         FROM budget_reference br
        WHERE 1 = 1
          ${searchClause}
        ORDER BY br.created_at DESC`,
      params,
    );
    return result.rows.map((row) => {
      const allocated = Number(row.allocated) || 0;
      const issued = Number(row.issued) || 0;
      const expenses = Number(row.expenses) || 0;
      const forwarded = Number(row.forwarded) || 0;
      return {
        ...row,
        allocated,
        issued,
        expenses,
        employeeExpenses: Number(row.employee_expenses) || 0,
        settledAbono: Number(row.settled_abono) || 0,
        forwarded,
        remaining: allocated - issued - expenses + forwarded,
      };
    });
  }

  // Update a source of funds (label / notes / status). Closing
  // ('open' → 'cut_off') disconnects the source from every flow; reopening
  // restores it. Status flips touch ONLY the status column — `date_cut_off`
  // is never written here. Resolves null when the reference does not exist.
  static async updateReference(reference_id, { label, notes, status, date_cut_off }) {
    const sets = [];
    const params = [];
    if (label !== undefined) {
      params.push(String(label).trim());
      sets.push(`label = $${params.length}`);
    }
    if (notes !== undefined) {
      const trimmed = String(notes ?? "").trim();
      params.push(trimmed === "" ? null : trimmed);
      sets.push(`notes = $${params.length}`);
    }
    // Explicit cut-off date (null clears it). Skipped when the same request
    // also flips `status` — the status CASE below owns the column then, and
    // Postgres rejects two assignments to one column in a single UPDATE.
    if (date_cut_off !== undefined && status === undefined) {
      params.push(date_cut_off);
      sets.push(`date_cut_off = $${params.length}::timestamptz`);
    }
    if (status !== undefined) {
      // Close / reopen touches ONLY the status column — `date_cut_off` is
      // never written here (it is owned by the create / edit date picker).
      params.push(status);
      const statusParam = params.length;
      sets.push(`status = $${statusParam}`);
    }
    if (sets.length === 0) return null;
    params.push(reference_id);
    const result = await query(
      `UPDATE budget_reference
          SET ${sets.join(", ")}
        WHERE reference_id = $${params.length}
        RETURNING reference_id, label, notes, status, date_cut_off, created_at`,
      params,
    );
    return result.rows[0] ?? null;
  }
  // Budget Reference
  static async budgetReference() {
    const result = await query(
      `SELECT
        reference_id,
        label, created_at, status, date_cut_off,
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
  //                budget_issued_reference rows tied to this reference, open
  //                OR closed holdings alike (handed-out money left the source
  //                either way — only the source itself gates this, plus live
  //                children)
  // - `expenses`:  SUM(expenses.total_amount) — funds already spent against
  //                this reference by saved expenses
  // - `employee_expenses`: display-only SUM of PAID expenses authored by
  //                employees for this reference. Never enters `balance`
  //                (that spend already left as `issued` — adding it would
  //                double-subtract); rendered as its own line so employee
  //                spend stays visible.
  // - `forwarded`: SUM(budget_issued_reference.balance_forwarded) — leftovers
  //                handed back by finalized (`close`) holdings, spendable again
  // - `balance`:   allocated - issued - expenses + forwarded (what can still
  //                be issued), the same formula the AdminBudget overview uses.
  // Scalar subqueries with COALESCE keep empty references at 0 instead of NULL
  // (SUM returns NULL over zero rows).
  //
  // Employee expenses ARE tagged with their source reference now, but their
  // spend left the reference when it was issued — counting those rows here as
  // well would subtract them twice, so every admin-side expense sum below
  // (here and in expenses.model.js) skips rows owned by an employee.
  static async referenceBalance(referenceId) {
    // A closed source has no balance to show — nobody, no footsteps.
    if (!(await Budget.isReferenceOpen(referenceId))) {
      return { allocated: 0, issued: 0, expenses: 0, employee_expenses: 0, forwarded: 0, balance: 0 };
    }
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
              AND i.status != 'cancel'
          ), 0) AS issued,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            WHERE e.reference_id = $1  AND e.status = 'paid'
              AND NOT EXISTS (
                SELECT 1 FROM users u
                 WHERE u.user_id = e.user_id AND u.role = 'employee'
              )
          ), 0) AS expenses,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            WHERE e.reference_id = $1  AND e.status = 'paid'
              AND EXISTS (
                SELECT 1 FROM users u
                 WHERE u.user_id = e.user_id AND u.role = 'employee'
              )
          ), 0) AS employee_expenses,
          COALESCE((
            SELECT SUM(bir.balance_forwarded)
            FROM budget_issued_reference bir
            WHERE bir.reference_id = $1
              AND bir.status = 'close'
          ), 0) AS forwarded`,
      [referenceId],
    );

    const row = result.rows[0] ?? { allocated: 0, issued: 0, expenses: 0, employee_expenses: 0, forwarded: 0 };
    const allocated = Number(row.allocated);
    const issued = Number(row.issued);
    const expenses = Number(row.expenses);
    const employeeExpenses = Number(row.employee_expenses);
    const forwarded = Number(row.forwarded);
    return {
      allocated,
      issued,
      expenses,
      employee_expenses: employeeExpenses,
      forwarded,
      balance: allocated - issued - expenses + forwarded,
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
         -- A cut-off source connects to nothing: holdings under it neither
         -- block new issuances nor surface as usable funds.
         AND br.status = 'open'
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
  static async employeeBudget(userId, { search, issuedRefId, openOnly } = {}) {
    // Single-issuance view: scope every leg by `budget_issued_reference.id`
    // via `issued_ref_id` (see AdminEmployeesDetails). Transfers expose their
    // real `issued_ref_id` — never NULL — so a bir-id link shows exactly the
    // moves funded by that record. Received legs are excluded when scoped:
    // they carry the sender's issuance id, never this record's.
    if (issuedRefId) {
      return this.employeeBudgetByIssuedRef(userId, issuedRefId, { search });
    }
    // Whole-account view: every leg keys on the user's OPEN holdings for
    // the same (reference_id, user_id) — `budget_issued_reference.status =
    // 'open'` — then pins the child row through `issued_ref_id =
    // budget_issued_reference.id`. Closed holdings leave no footsteps in
    // sums OR lists. (`openOnly` is accepted for API compatibility — the base
    // path is already strict so it adds nothing.)
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
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.user_id = $1 AND bir.status = 'open'
              AND br.status = 'open'
              AND ib.status != 'cancel'
          ), 0)::float8 AS total_budget,
          COALESCE((
            -- Spent is PAID expenses only (see employee.overview.model):
            -- settled abono is handed back as an issued child, so counting
            -- it here too would charge the same money twice.
            SELECT COALESCE(SUM(e.total_amount), 0)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
              AND (e.reference_id IS NULL OR EXISTS (
                SELECT 1
                  FROM budget_issued_reference bir2
                 WHERE bir2.user_id = e.user_id
                   AND bir2.reference_id = e.reference_id
                   AND bir2.status = 'open'
                   AND bir2.id = e.issued_ref_id
              ))
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.user_id = $1 AND ea.status = 'open'
              AND br.status = 'open'
              AND EXISTS (
                SELECT 1
                  FROM budget_issued_reference bir2
                 WHERE bir2.user_id = ea.user_id
                   AND bir2.reference_id = ea.reference_id
                   AND bir2.status = 'open'
                   AND bir2.id = ea.issued_ref_id
              )
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            JOIN budget_issued_reference birf ON birf.id = bt.issued_ref_id
              AND birf.status = 'open'
              AND birf.user_id = bt.user_id
            WHERE bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          COALESCE((
            -- Closed-holding gate (see the roster): a received transfer
            -- whose stamped receiving holding has since closed leaves no
            -- footsteps; unstamped legacy rows keep counting.
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = $1 AND btr.status = 'success'
              AND (
                btr.issued_ref_id_sent IS NULL
                OR EXISTS (
                  SELECT 1 FROM budget_issued_reference birs
                   WHERE birs.id = btr.issued_ref_id_sent
                     AND birs.status = 'open'
                )
              )
          ), 0)::float8 AS total_received,
          COALESCE((
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.user_id = $1 AND bir.status = 'open'
              AND br.status = 'open'
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
            ib.status,
            bir.date_cut_off,
            NULL AS counterparty,
            ib.created_at AS date,
            ib.created_at AS created_at
           FROM budget_issued_reference bir
           JOIN issued_budget ib ON ib.issued_ref_id = bir.id
           JOIN budget_reference br ON br.reference_id = bir.reference_id
              AND br.status = 'open'
          WHERE bir.user_id = $1
            AND bir.status = 'open'
        UNION ALL
         SELECT
            bt.id,
            bt.issued_ref_id,
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
           JOIN budget_issued_reference birf ON birf.id = bt.issued_ref_id
             AND birf.status = 'open'
             AND birf.user_id = bt.user_id
          WHERE bt.user_id = $1 AND bt.status = 'success'
            AND br.status = 'open'
        UNION ALL
         SELECT
            bt.id,
            bt.issued_ref_id,
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
            AND br.status = 'open'
            -- Same closed-holding gate as the total above: closed-linked
            -- received rows leave the list together with the balance.
            AND (
              bt.issued_ref_id_sent IS NULL
              OR EXISTS (
                SELECT 1 FROM budget_issued_reference birs
                 WHERE birs.id = bt.issued_ref_id_sent
                   AND birs.status = 'open'
              )
            )
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

  // Single-issuance budget ledger — every leg keyed on
  // `budget_issued_reference.id` via `issued_ref_id`.
  static async employeeBudgetByIssuedRef(userId, issuedRefId, { search } = {}) {
    const overviewResult = await query(
      `SELECT
          COALESCE((
            SELECT SUM(ib.amount)
            FROM budget_issued_reference bir
            JOIN issued_budget ib ON ib.issued_ref_id = bir.id
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.id = $2 AND bir.user_id = $1
              AND br.status = 'open'
              AND ib.status != 'cancel'
          ), 0)::float8 AS total_budget,
          COALESCE((
            -- Same paid-expenses-only rule as the whole-account hero above:
            -- this record's settled abono is handed back, not spent.
            SELECT COALESCE(SUM(e.total_amount), 0)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.issued_ref_id = $2 AND e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.issued_ref_id = $2 AND ea.user_id = $1 AND ea.status = 'open'
              AND br.status = 'open'
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            WHERE bt.issued_ref_id = $2 AND bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          -- Received is the user's money however it arrived
          -- (sender-stamped, never this record's): same whole-account
          -- predicate as every other surface, with the same
          -- closed-holding gate, so record views agree everywhere.
          COALESCE((
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = $1 AND btr.status = 'success'
              AND (
                btr.issued_ref_id_sent IS NULL
                OR EXISTS (
                  SELECT 1 FROM budget_issued_reference birs
                   WHERE birs.id = btr.issued_ref_id_sent
                     AND birs.status = 'open'
                )
              )
          ), 0)::float8 AS total_received,
          COALESCE((
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.id = $2 AND bir.user_id = $1
              AND bir.status = 'open'
              AND br.status = 'open'
          ), 0)::int AS active_references`,
      [userId, issuedRefId],
    );

    const txParams = [userId, issuedRefId];
    let searchClause = "";
    if (search && search.trim()) {
      txParams.push(`%${search.trim()}%`);
      searchClause = `WHERE (t.description ILIKE $3
              OR t.notes ILIKE $3
              OR t.method ILIKE $3
              OR t.source_of_funds ILIKE $3
              OR t.counterparty ILIKE $3
              OR t.kind ILIKE $3
              OR t.direction ILIKE $3)`;
    }

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
            ib.status,
            bir.date_cut_off,
            NULL AS counterparty,
            ib.created_at AS date,
            ib.created_at AS created_at
           FROM budget_issued_reference bir
           JOIN issued_budget ib ON ib.issued_ref_id = bir.id
           JOIN budget_reference br ON br.reference_id = bir.reference_id
              AND br.status = 'open'
          WHERE bir.id = $2 AND bir.user_id = $1
        UNION ALL
         SELECT
            bt.id,
            bt.issued_ref_id,
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
          WHERE bt.issued_ref_id = $2 AND bt.user_id = $1 AND bt.status = 'success'
            AND br.status = 'open'
        UNION ALL
         SELECT
            bt.id,
            bt.issued_ref_id,
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
            AND br.status = 'open'
            -- Same closed-holding gate as the total above: closed-linked
            -- received rows leave the list together with the balance.
            AND (
              bt.issued_ref_id_sent IS NULL
              OR EXISTS (
                SELECT 1 FROM budget_issued_reference birs
                 WHERE birs.id = bt.issued_ref_id_sent
                   AND birs.status = 'open'
              )
            )
       ) t
       ${searchClause}
       ORDER BY t.created_at DESC`,
      txParams,
    );

    const row = overviewResult.rows[0] ?? {};
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

  // Close every OPEN issuance reference a user holds (status 'open' ->
  // 'close', stamping `date_forwarded` with the confirmation moment),
  // scoped to open budget sources like every other page query.
  // Used by the reimbursement submit flow: finalizing hands the holdings
  // back, so the employee disappears from open-issuance ledgers and the
  // issued amounts drop out of every money sum (they all read open parents
  // with live children only). The partial unique index covers 'open' rows
  // only, so a future issuance for the same pair can start fresh.
  // Each closed row also records its handover state in the same write:
  //   - `notes`: the submit dialog's optional note (keeps the row's existing
  //     notes when no note was given).
  //   - `balance_forwarded`: that record's leftover at close time — its own
  //     live issued children + its own OPEN abono − its own PAID expenses −
  //     its own sent transfers + its own stamped received transfers −
  //     its own settled abono, i.e. EXACTLY the balance the review page
  //     shows (`records` endpoint formula), so the stored figure never
  //     disagrees with the submitted display. All legs key on this
  //     record's own id (`issued_ref_id` / `issued_ref_id_sent = bir.id`)
  //     so sibling records sharing the source never leak into each other.
  //     Settled abono is NOT spent, but it IS backed out of funding (its
  //     re-booked children read as issued), matching every display.
  //     Computed BEFORE the status flips, in the same statement (0 stays 0).
  // Resolves `{ closedCount }`.
  static async closeOpenIssuedReferences(userId, { note } = {}) {
    const result = await query(
      `UPDATE budget_issued_reference bir
          SET status = 'close',
              date_forwarded = NOW(),
              notes = COALESCE($2, bir.notes),
              balance_forwarded = (
                COALESCE((
                  SELECT SUM(ib.amount)
                    FROM issued_budget ib
                    JOIN budget_reference br2 ON br2.reference_id = bir.reference_id
                   WHERE ib.issued_ref_id = bir.id
                     AND ib.status != 'cancel'
                     AND br2.status = 'open'
                ), 0)
                + COALESCE((
                  SELECT SUM(ea.amount)
                    FROM employee_abono ea
                    JOIN budget_reference br2 ON br2.reference_id = ea.reference_id
                   WHERE ea.issued_ref_id = bir.id
                     AND ea.user_id = bir.user_id
                     AND ea.status = 'open'
                     AND br2.status = 'open'
                ), 0)
                - COALESCE((
                  SELECT SUM(e.total_amount)
                    FROM expenses e
                    LEFT JOIN budget_reference br2 ON br2.reference_id = e.reference_id
                   WHERE e.issued_ref_id = bir.id
                     AND e.user_id = bir.user_id
                     AND e.status = 'paid'
                     AND (e.reference_id IS NULL OR br2.status = 'open')
                ), 0)
                - COALESCE((
                  SELECT SUM(bt.amount)
                    FROM budget_transfer bt
                   WHERE bt.issued_ref_id = bir.id
                     AND bt.user_id = bir.user_id
                     AND bt.status = 'success'
                ), 0)
                + COALESCE((
                  -- Stamp-scoped: only transfers stamped to THIS record bank
                  -- into its forwarded — the same definition the record
                  -- legs use, so recomputes always reconcile to stored.
                  SELECT SUM(btr.amount)
                    FROM budget_transfer btr
                   WHERE btr.issued_ref_id_sent = bir.id
                     AND btr.status = 'success'
                ), 0)
                - COALESCE((
                  -- Record-scoped settled: backed out of funding like every
                  -- display, so stored equals submitted.
                  SELECT SUM(ea.amount)
                    FROM employee_abono ea
                    JOIN budget_reference br2 ON br2.reference_id = ea.reference_id
                   WHERE ea.issued_ref_id = bir.id
                     AND ea.user_id = bir.user_id
                     AND ea.status = 'settled'
                     AND br2.status = 'open'
                ), 0)
              )
         FROM budget_reference br
        WHERE bir.user_id = $1
          AND bir.status = 'open'
          AND br.reference_id = bir.reference_id
          AND br.status = 'open'
        RETURNING bir.id`,
      [userId, note ?? null],
    );
    return { closedCount: result.rows.length };
  }

  // Reopen one finalized issuance reference (status 'close' -> 'open'):
  // the undo of the reimbursement submit for a single record. The row is
  // locked, must currently be closed, its source must still be open
  // (reopening under a cut-off source would reconnect dead money), and no
  // sibling OPEN row may hold the same (user_id, reference_id) pair (the
  // partial unique index covers open rows only — two live parents for one
  // pair would violate it). `date_forwarded` clears (no longer finalized);
  // `notes` / `balance_forwarded` stay as the close-time audit trail and
  // are recomputed on the next submit. Resolves `{ notFound, notClosed,
  // sourceClosed, conflict, issuedReference }`.
  static async reopenIssuedReference(id) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      const found = (
        await q(
          `SELECT bir.id, bir.user_id, bir.reference_id, bir.status,
                  br.status AS source_status
             FROM budget_issued_reference bir
             JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.id = $1
            FOR UPDATE OF bir`,
          [id],
        )
      ).rows[0] ?? null;

      if (!found) return { notFound: true };
      if (found.status !== "close") return { notClosed: true };
      if ((found.source_status ?? null) !== "open")
        return { sourceClosed: true };

      const [sibling] = (
        await q(
          `SELECT id
             FROM budget_issued_reference
            WHERE user_id = $1 AND reference_id = $2
              AND status = 'open' AND id <> $3
            LIMIT 1`,
          [found.user_id, found.reference_id, found.id],
        )
      ).rows;

      if (sibling) return { conflict: true, siblingId: sibling.id };

      const reopened = (
        await q(
          `UPDATE budget_issued_reference
              SET status = 'open', date_forwarded = NULL
            WHERE id = $1
            RETURNING *`,
          [id],
        )
      ).rows[0];

      return { issuedReference: reopened };
    });
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
              OR br.label ILIKE $1)
            AND br.status = 'open'`
      : `WHERE br.status = 'open'`;

    // `::float8` casts DECIMAL (returned by pg as strings) to a JS number.
    // Closed sources leave no footsteps: rows under a cut-off source never
    // list here (`bib.reference_id` is NOT NULL, so the condition is safe).
    // The displayed status is the PARENT's when it is closed — every child
    // under a 'close' parent reads 'Closed' and its actions lock — else the
    // CHILD's when it is cancelled, else the parent's. `parent_status` is
    // also returned so callers that speak child vocabulary can still tell a
    // closed parent apart from a live one.
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
          ib.image_url,
          ib.created_at AS date_issued,
          CASE WHEN bib.status = 'close' THEN 'close'
               WHEN ib.status = 'cancel' THEN 'cancel'
               ELSE bib.status END AS status,
          ib.status AS issued_status,
          bib.status AS parent_status
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
    // Closed sources leave no footsteps: rows under a cut-off source never
    // list here (`budget.reference_id` is NOT NULL, so the inner condition
    // is safe).
    const result = await query(
      `SELECT
          b.id,
          b.reference_id,
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
       ${where.length ? `WHERE ${where.join(" AND ")} AND br.status = 'open'` : `WHERE br.status = 'open'`}
       ORDER BY b.created_at DESC`,
      params,
    );
    return result.rows;
  }

  // Cancel a budget transaction — sets status = 'cancelled' and stamps
  // cancelled_at. Take-back guard: cancelling pulls this allocation OUT of
  // its budget source, so when the row's amount exceeds the source's
  // remaining balance the cancel is refused with `{ insufficientBalance:
  // true, amount, remaining, sourceLabel }` (nothing is written). Remaining
  // is exactly the AdminBudget "My Balance" breakdown figure for the row's
  // own reference: allocated (non-cancelled) − open issued − non-employee
  // expenses. Returns the previous status (so the UI can offer an undo)
  // plus the updated row, or null when the id does not exist.
  static async cancelBudget(id) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      const previous =
        (
          await q(
            `SELECT b.id,
                    b.status,
                    b.amount::float8 AS amount,
                    b.reference_id,
                    br.label AS source_label
               FROM budget b
               LEFT JOIN budget_reference br ON br.reference_id = b.reference_id
              WHERE b.id = $1
              FOR UPDATE OF b`,
            [id],
          )
        ).rows[0] ?? null;
      if (!previous) return null;

      // Idempotent: already cancelled — nothing left to take back.
      if (previous.status === "cancelled")
        return {
          previousStatus: previous.status,
          budget: previous,
          alreadyCancelled: true,
        };

      const pool = (
        await q(
          `SELECT
              COALESCE((
                SELECT SUM(b2.amount)
                  FROM budget b2
                 WHERE b2.reference_id = $1 AND b2.status != 'cancelled'
              ), 0)::float8 AS allocated,
              COALESCE((
              SELECT SUM(i.amount)
                 FROM budget_issued_reference bir
                 JOIN issued_budget i ON i.issued_ref_id = bir.id
                WHERE bir.reference_id = $1
                  AND i.status != 'cancel'
             ), 0)::float8 AS issued,
              COALESCE((
              SELECT SUM(e.total_amount)
                 FROM expenses e
                WHERE e.reference_id = $1
                  AND NOT EXISTS (
                    SELECT 1 FROM users u
                     WHERE u.user_id = e.user_id AND u.role = 'employee'
                  )
             ), 0)::float8 AS spent,
              COALESCE((
                SELECT SUM(bir.balance_forwarded)
                  FROM budget_issued_reference bir
                 WHERE bir.reference_id = $1
                   AND bir.status = 'close'
             ), 0)::float8 AS forwarded`,
          [previous.reference_id],
        )
      ).rows[0] ?? {};

      const remaining = toMoney(
        Number(pool.allocated || 0) -
          Number(pool.issued || 0) -
          Number(pool.spent || 0) +
          Number(pool.forwarded || 0),
      );
      const amount = toMoney(previous.amount);

      if (amount > remaining)
        return {
          insufficientBalance: true,
          amount,
          remaining,
          sourceLabel: previous.source_label,
        };

      const result = await q(
        `UPDATE budget
            SET status = 'cancelled',
                cancelled_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
          RETURNING *`,
        [id],
      );
      return { previousStatus: previous.status, budget: result.rows[0] };
    });
  }

  // Undo a cancellation — restore the transaction to its previous status
  // ('added' | 'closed') and clear the cancellation stamp. Refuses with
  // `{ notOpen: true }` when the row's source of funds is no longer open —
  // restoring would reconnect a disconnected source.
  static async restoreBudget(id, status) {
    const owner = await query(
      `SELECT b.reference_id, br.status AS ref_status
         FROM budget b
         LEFT JOIN budget_reference br ON br.reference_id = b.reference_id
        WHERE b.id = $1`,
      [id],
    );
    const row = owner.rows[0];
    if (!row) return null;
    if ((row.ref_status ?? null) !== "open") return { notOpen: true };
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

  // Permanently deletes ONE cancelled `budget` row (hard delete). The
  // status predicate lives INSIDE the DELETE so the check-and-delete is a
  // single atomic step — a concurrent restore can never slip a live row
  // through. Refusals resolve (never throw):
  //   - row missing → `{ notFound: true }`
  //   - status is not 'cancelled' → `{ notCancelled: true, status }`. Live
  //     rows must be cancelled first; cancel-then-delete is the path.
  // No dependent-row guard is needed: nothing references `budget.id` —
  // issuances, expenses, abono and transfers all key off
  // `budget_reference.reference_id`, which this never touches. The source
  // itself (and its remaining budget) is unaffected beyond losing this
  // allocation from its total.
  static async removeTransaction(id) {
    const deleted = (
      await query(
        `DELETE FROM budget
          WHERE id = $1 AND status = 'cancelled'
          RETURNING *`,
        [id],
      )
    ).rows[0];

    if (deleted) return { notFound: false, deleted };

    const found = (
      await query(`SELECT id, status FROM budget WHERE id = $1`, [id])
    ).rows[0];

    if (!found) return { notFound: true };
    return { notFound: false, notCancelled: true, status: found.status };
  }

  // Cancel ONE issued budget transaction — flips the `issued_budget` row
  // itself to status 'cancel' by its id (`ib.id` is the exact target). No new
  // row is ever created and the parent `budget_issued_reference` keeps its
  // status, so sibling issuances sharing the parent are untouched.
  //
  // Every issued-money sum counts only live children
  // (`ib.status != 'cancel'`), so the cancelled amount drops out of the
  // pool the moment this writes. Take-back guard: when the row's amount
  // exceeds the employee's remaining balance the cancel is refused with
  // `{ insufficientBalance: true, amount, remaining, employeeName }`
  // (nothing is written). Returns `{ previousStatus, issuedReference }`
  // (`previousStatus` speaks the child vocabulary: 'added'), or null when
  // the id does not exist.
  static async cancelIssuedTransaction(id) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      // Lock the parent row so two concurrent cancels serialize on it. The
      // exact target is the `issued_budget` row itself (`ib.id`) — its own
      // `status` flips, never the parent's.
      const found =
        (
          await q(
            `SELECT
                ib.id,
                ib.issued_ref_id,
                ib.amount::float8 AS amount,
                ib.status AS ib_status,
                bir.status AS bir_status,
                bir.user_id,
                u.name AS employee_name
               FROM issued_budget ib
               JOIN budget_issued_reference bir ON bir.id = ib.issued_ref_id
               JOIN users u ON u.user_id = bir.user_id
              WHERE ib.id = $1
              FOR UPDATE OF bir`,
            [id],
          )
        ).rows[0] ?? null;

      if (!found) return null;

      // Finalized holdings are read-only — a `close` parent locks its
      // children to "View details" only (see TransactionsTable).
      if (found.bir_status === "close") return { closedHolding: true };

      const previousStatus = found.ib_status;

      // Idempotent: already cancelled — nothing to write.
      if (previousStatus === "cancel")
        return { previousStatus, issuedReference: null };

      // Take-back guard: cancelling pulls this issuance OUT of the
      // employee's pool, so when they already spent it (their remaining
      // can't cover the take-back) the cancel is refused — same protection
      // as the transfer cancel guard. Remaining mirrors the strict
      // (open-holdings-only) totalBalance the AdminEmployeesDetails overview
      // shows: OPEN issuances + OPEN abono − PAID expenses − sent transfers
      // + received transfers. It includes this row (still open).
      // Every leg keys on that user's `budget_issued_reference` rows with
      // `status = 'open'` — closed holdings (and cut-off sources) never fund
      // the pool, so a cancel can no longer be approved against money the
      // pages no longer display. Received transfers stay keyed by recipient:
      // inbound money carries the sender's `issued_ref_id`, never a holding
      // of this user.
      // Abono-first order: the employee's OPEN abono (the same figure the
      // AdminEmployeesDetails "abono" value shows) is minused from the
      // remaining balance BEFORE the issuance amount — the take-back may
      // only draw from non-abono funds, so a cancel is allowed when
      // (remaining − abono) >= amount (exact cover counts — refusing it
      // stranded fully-coverable rows). Settled/draft abono never fund the
      // pool (the query below counts `status = 'open'` only).
      const pool = (
        await q(
          `SELECT
              COALESCE((
                SELECT SUM(ib2.amount)
                  FROM budget_issued_reference bir2
                  JOIN issued_budget ib2 ON ib2.issued_ref_id = bir2.id
                  JOIN budget_reference br ON br.reference_id = bir2.reference_id
                 WHERE bir2.user_id = $1 AND bir2.status = 'open'
                   AND br.status = 'open'
                   AND ib2.status != 'cancel'
              ), 0)::float8 AS total_budget,
              COALESCE((
                SELECT SUM(ea.amount)
                  FROM employee_abono ea
                  JOIN budget_reference br ON br.reference_id = ea.reference_id
                 WHERE ea.user_id = $1 AND ea.status = 'open'
                   AND br.status = 'open'
                   AND EXISTS (
                     SELECT 1 FROM budget_issued_reference bir2
                     WHERE bir2.user_id = ea.user_id
                       AND bir2.reference_id = ea.reference_id
                       AND bir2.status = 'open'
                       AND bir2.id = ea.issued_ref_id
                   )
              ), 0)::float8 AS total_abono,
              COALESCE((
                -- Paid-expenses-only spent (see the hero above): settled
                -- abono is handed back, so the guard must not treat it as
                -- gone.
                SELECT COALESCE(SUM(e.total_amount), 0)
                FROM expenses e
                LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
                 WHERE e.user_id = $1 AND e.status = 'paid'
                   AND (e.reference_id IS NULL OR br.status = 'open')
                   AND (e.reference_id IS NULL OR EXISTS (
                     SELECT 1 FROM budget_issued_reference bir2
                     WHERE bir2.user_id = e.user_id
                       AND bir2.reference_id = e.reference_id
                       AND bir2.status = 'open'
                       AND bir2.id = e.issued_ref_id
                   ))
              ), 0)::float8 AS total_expenses,
              COALESCE((
                SELECT SUM(bt.amount)
                  FROM budget_transfer bt
                  JOIN budget_issued_reference birf ON birf.id = bt.issued_ref_id
                    AND birf.status = 'open'
                    AND birf.user_id = bt.user_id
                 WHERE bt.user_id = $1 AND bt.status = 'success'
              ), 0)::float8 AS total_sent,
              COALESCE((
                SELECT SUM(btr.amount)
                  FROM budget_transfer btr
                 WHERE btr.transfer_to = $1 AND btr.status = 'success'
              ), 0)::float8 AS total_received`,
          [found.user_id],
        )
      ).rows[0] ?? {};

      const remaining = toMoney(
        Number(pool.total_budget || 0) +
          Number(pool.total_abono || 0) -
          Number(pool.total_expenses || 0) -
          Number(pool.total_sent || 0) +
          Number(pool.total_received || 0),
      );
      const amount = toMoney(found.amount);
      // Abono-first: minus the OPEN abono from the remaining balance first,
      // then measure the issuance amount against what is left.
      const openAbono = Math.max(0, Number(pool.total_abono || 0));
      const coverable = toMoney(remaining - openAbono);

      // Refuse only when the take-back truly exceeds what is coverable —
      // an exact match still leaves the pool whole. Both sides are
      // cent-rounded (toMoney), so `===` needs no epsilon here.
      if (coverable < amount)
        return {
          insufficientBalance: true,
          amount,
          remaining: coverable,
          employeeName: found.employee_name,
        };

      // Flip THIS `issued_budget` row only — the parent keeps its status so
      // sibling issuances sharing it are untouched, and no new row is ever
      // created. ('added'/'cancel' is the child vocabulary; the parent keeps
      // speaking 'open'/'cancel'.)
      await q(
        `UPDATE issued_budget
            SET status = 'cancel',
                updated_at = NOW()
          WHERE id = $1`,
        [id],
      );
      const parent =
        (
          await q(`SELECT * FROM budget_issued_reference WHERE id = $1`, [
            found.issued_ref_id,
          ])
        ).rows[0] ?? null;
      return {
        previousStatus,
        issuedReference: parent,
      };
    });
  }

  // Undo an issued cancellation for ONE `issued_budget` row — flips the child
  // back to live. The requested `status` speaks parent vocabulary (the UI
  // sends 'open'), so it is translated to the child vocabulary ('added')
  // here. If an OPEN parent still exists for the same (user_id,
  // reference_id) that is NOT the row's current parent (leftover split rows
  // from the old behavior), the row is moved back onto it — two OPEN parents
  // for one pair would violate the partial unique index from migration 003.
  static async restoreIssuedTransaction(id, status) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      const found =
        (
          await q(
            `SELECT
                ib.id,
                ib.issued_ref_id,
                ib.status AS ib_status,
                bir.user_id,
                bir.reference_id
               FROM issued_budget ib
               JOIN budget_issued_reference bir ON bir.id = ib.issued_ref_id
              WHERE ib.id = $1
              FOR UPDATE OF bir`,
            [id],
          )
        ).rows[0] ?? null;

      if (!found) return null;

      // A cut-off source connects to nothing — restoring would reconnect
      // it, so the undo is refused while the source stays disconnected.
      const source = (
        await q(`SELECT status FROM budget_reference WHERE reference_id = $1`, [
          found.reference_id,
        ])
      ).rows[0];
      if ((source?.status ?? null) !== "open") return { notOpen: true };

      // Parent vocabulary ('open') → child vocabulary ('added'). Anything
      // else is not a live child state.
      const targetChild = status === "open" ? "added" : null;
      if (!targetChild) return null;

      // The live parent this employee's pair is supposed to share.
      const openParent =
        (
          await q(
            `SELECT *
               FROM budget_issued_reference
              WHERE user_id = $1
                AND reference_id = $2
                AND status = 'open'
              FOR UPDATE`,
            [found.user_id, found.reference_id],
          )
        ).rows[0] ?? null;

      // Already live on the right parent — nothing to write.
      if (
        found.ib_status === targetChild &&
        openParent &&
        openParent.id === found.issued_ref_id
      ) {
        return openParent;
      }

      await q(
        `UPDATE issued_budget
            SET status = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [id, targetChild],
      );

      if (openParent && openParent.id !== found.issued_ref_id) {
        await q(
          `UPDATE issued_budget
              SET issued_ref_id = $2,
                  updated_at = NOW()
            WHERE id = $1`,
          [id, openParent.id],
        );
        return openParent;
      }

      return (
        (
          await q(`SELECT * FROM budget_issued_reference WHERE id = $1`, [
            found.issued_ref_id,
          ])
        ).rows[0] ?? null
      );
    });
  }

  // Permanently deletes ONE cancelled `issued_budget` row (hard delete) plus  // its parent `budget_issued_reference` when the deleted row was its last
  // child. Business-rule refusals resolve (never throw — same style as the
  // transfer cancel guard):
  //   - row missing → `{ notFound: true }`
  //   - the row itself is not 'cancel' → `{ notCancelled: true, status }`
  //     (child vocabulary: 'added'). Live rows must be cancelled first;
  //     cancel-then-delete is the path.
  // Resolves `{ deleted, parentPruned }` on success.
  static async removeIssuedTransaction(id) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      const found =
        (
          await q(
            `SELECT ib.id,
                    ib.issued_ref_id,
                    ib.status AS ib_status,
                    bir.status AS bir_status,
                    bir.user_id,
                    bir.reference_id
               FROM issued_budget ib
               JOIN budget_issued_reference bir ON bir.id = ib.issued_ref_id
              WHERE ib.id = $1
              FOR UPDATE OF bir`,
            [id],
          )
        ).rows[0] ?? null;

      if (!found) return { notFound: true };

      // Finalized holdings are read-only — even cancelled children under a
      // `close` parent stay locked to "View details" only.
      if (found.bir_status === "close") return { closedHolding: true };

      if (found.ib_status !== "cancel")
        return { notFound: false, notCancelled: true, status: found.ib_status };

      const deleted = (
        await q(`DELETE FROM issued_budget WHERE id = $1 RETURNING *`, [id])
      ).rows[0];

      // Prune the parent when no children remain — otherwise a childless
      // shell lingers in guard/overview queries. Safe: nothing else
      // references a parent id (expenses track `reference_id`, not parents),
      // and surviving siblings keep the parent alive otherwise.
      const remaining = (
        await q(
          `SELECT COUNT(*)::int AS count
             FROM issued_budget
            WHERE issued_ref_id = $1`,
          [found.issued_ref_id],
        )
      ).rows[0];

      let parentPruned = false;
      if (remaining && remaining.count === 0) {
        await q(`DELETE FROM budget_issued_reference WHERE id = $1`, [
          found.issued_ref_id,
        ]);
        parentPruned = true;
      }

      // `issued_budget` carries no `user_id` (ownership lives on the parent
      // `budget_issued_reference`), so surface it from the locked parent row.
      // Without this the controller can't target the owner's personal socket
      // room and the employee ledger never refreshes on delete.
      return {
        notFound: false,
        deleted: deleted ?? null,
        parentPruned,
        userId: found.user_id ?? null,
        reference_id: found.reference_id ?? null,
      };
    });
  }

  // How many surviving `issued_budget` rows still point at an
  // `uploads/receipts_issued_budget` URL — the delete controller drops the
  // file only once the count hits zero, so a shared image is never removed
  // while another row still references it.
  static async countIssuedByImageUrl(image_url) {
    if (!image_url) return 0;
    const result = await query(
      `SELECT COUNT(*)::int AS count
         FROM issued_budget
        WHERE image_url = $1`,
      [image_url],
    );
    return result.rows[0]?.count ?? 0;
  }
}

export default Budget;
