import { query, withTransaction } from "../config/db.js";

// Round to centavos so balances read exactly 0 instead of a floating-point
// residue (same helper every overview model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Columns safe to expose for the employee picker / owner card (never the
// password hash).
const EMPLOYEE_COLUMNS = "u.user_id, u.name, u.email, u.avatar_url";

// Budget transfers move spendable funds between accounts and are recorded in
// `budget_transfer` alone: `user_id` is the sender, `transfer_to` is the
// recipient. Only rows with status 'success' move money — 'cancel' rows are
// kept for the audit trail and never count toward any balance.
class BudgetTransfer {
  // Spendable balance for the transfer form's hero + validation.
  //   - employee: open issuances + OPEN abono − PAID expenses − sent
  //     (success) + received (success). A transfer out shrinks the pool, a
  //     transfer in widens it — same money rule every overview model uses,
  //     extended with the transfer net so a moved peso can't be spent twice.
  //   - admin: has no personal ledger — the pool is every OPEN reference's
  //     remaining (allocated − issued − non-employee paid expenses) minus
  //     prior admin-sent transfers (those left the reference without an
  //     issuance row, so the reference sums alone would double-count them).
  static async spendableBalance(userId, role) {
    if (role === "admin") {
      const result = await query(
        `SELECT
            COALESCE((
              SELECT SUM(b.amount)
                FROM budget b
                JOIN budget_reference br ON br.reference_id = b.reference_id
               WHERE br.status = 'open' AND b.status != 'cancelled'
            ), 0)::float8 AS allocated,
            COALESCE((
              SELECT SUM(ib.amount)
                FROM budget_issued_reference bir
                JOIN issued_budget ib ON ib.issued_ref_id = bir.id
               WHERE bir.status = 'open'
            ), 0)::float8 AS issued,
            COALESCE((
              SELECT SUM(e.total_amount)
                FROM expenses e
               WHERE e.status = 'paid'
                 AND NOT EXISTS (
                   SELECT 1 FROM users u
                    WHERE u.user_id = e.user_id AND u.role = 'employee'
                 )
            ), 0)::float8 AS expenses,
            COALESCE((
              SELECT SUM(bt.amount)
                FROM budget_transfer bt
                JOIN users su ON su.user_id = bt.user_id
               WHERE bt.status = 'success' AND su.role = 'admin'
            ), 0)::float8 AS admin_sent`,
        [],
      );
      const r = result.rows[0] ?? {};
      return toMoney(
        Number(r.allocated || 0) -
          Number(r.issued || 0) -
          Number(r.expenses || 0) -
          Number(r.admin_sent || 0),
      );
    }

    const result = await query(
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
          ), 0)::float8 AS total_received`,
      [userId],
    );
    const r = result.rows[0] ?? {};
    return toMoney(
      Number(r.total_budget || 0) +
        Number(r.total_abono || 0) -
        Number(r.total_expenses || 0) -
        Number(r.total_sent || 0) +
        Number(r.total_received || 0),
    );
  }

  // Breakdown behind the hero figure so the confirm modal can quote it.
  static async balanceBreakdown(userId, role) {
    if (role === "admin") {
      const result = await query(
        `SELECT
            COALESCE((
              SELECT SUM(b.amount)
                FROM budget b
                JOIN budget_reference br ON br.reference_id = b.reference_id
               WHERE br.status = 'open' AND b.status != 'cancelled'
            ), 0)::float8 AS allocated,
            COALESCE((
              SELECT SUM(ib.amount)
                FROM budget_issued_reference bir
                JOIN issued_budget ib ON ib.issued_ref_id = bir.id
               WHERE bir.status = 'open'
            ), 0)::float8 AS issued,
            COALESCE((
              SELECT SUM(e.total_amount)
                FROM expenses e
               WHERE e.status = 'paid'
                 AND NOT EXISTS (
                   SELECT 1 FROM users u
                    WHERE u.user_id = e.user_id AND u.role = 'employee'
                 )
            ), 0)::float8 AS expenses,
            COALESCE((
              SELECT SUM(bt.amount)
                FROM budget_transfer bt
                JOIN users su ON su.user_id = bt.user_id
               WHERE bt.status = 'success' AND su.role = 'admin'
            ), 0)::float8 AS admin_sent`,
        [],
      );
      const r = result.rows[0] ?? {};
      const allocated = toMoney(r.allocated);
      const issued = toMoney(r.issued);
      const expenses = toMoney(r.expenses);
      const transferred = toMoney(r.admin_sent);
      return {
        totalAllocated: allocated,
        totalIssued: issued,
        totalExpenses: expenses,
        totalTransferred: transferred,
        totalBalance: toMoney(allocated - issued - expenses - transferred),
      };
    }

    const result = await query(
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
          ), 0)::float8 AS total_received`,
      [userId],
    );
    const r = result.rows[0] ?? {};
    const totalBudget = toMoney(r.total_budget);
    const totalExpenses = toMoney(r.total_expenses);
    const totalAbono = toMoney(r.total_abono);
    const totalSent = toMoney(r.total_sent);
    const totalReceived = toMoney(r.total_received);
    return {
      totalBudget,
      totalExpenses,
      totalAbono,
      totalSent,
      totalReceived,
      totalBalance: toMoney(
        totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
      ),
    };
  }

  // Recipient picker: active employees only (mirrors the budget page's
  // "Budget Issued" picker default), excluding the sender so nobody can
  // transfer to themselves.
  static async transferableEmployees(excludeUserId) {
    const result = await query(
      `SELECT ${EMPLOYEE_COLUMNS}
         FROM users u
        WHERE u.role = 'employee'
          AND u.status = 'active'
          AND u.user_id <> $1
        ORDER BY u.name ASC`,
      [excludeUserId],
    );
    return result.rows;
  }

  static async findCurrentUser(userId) {
    const result = await query(
      `SELECT user_id, name, email, avatar_url, role, status
         FROM users
        WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  static async findActiveEmployee(userId) {
    const result = await query(
      `SELECT ${EMPLOYEE_COLUMNS}, u.role, u.status
         FROM users u
        WHERE u.user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  // Creates the transfer in ONE transaction:
  //   1. re-reads + locks the sender side (employee open issuances, or the
  //      covering admin reference) so two concurrent submits can't both spend
  //      the same remaining peso,
  //   2. re-applies the money rule — a request the remaining balance can't
  //      cover resolves `insufficient: true` with nothing written,
  //   3. inserts the `budget_transfer` row (status 'success'). The recipient
  //      reads it through `transfer_to` — no mirror table is written.
  // `reference_id` is resolved server-side, never trusted from the client:
  //   - employee: their OLDEST open issuance (same "oldest-funding-first"
  //     order Abono uses), since issued money already left the reference —
  //     the transfer just moves it between employees,
  //   - admin: the OLDEST open reference whose remaining (allocated − issued
  //     − expenses − prior admin-sent) still covers the amount — fresh money
  //     leaving the reference for the first time.
  // Resolves `{ insufficient, noReference, requested, totalBalance, transfer }`.
  static async createTransfer({
    senderId,
    senderRole,
    transferTo,
    amount,
    notes,
    method,
  }) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);
      const requested = toMoney(amount);

      // Recipient is re-checked inside the transaction — the picker may have
      // loaded before the account was suspended.
      const recipient = (
        await q(
          `SELECT user_id, role, status FROM users WHERE user_id = $1`,
          [transferTo],
        )
      ).rows[0];
      if (
        !recipient ||
        recipient.role !== "employee" ||
        recipient.status !== "active" ||
        String(recipient.user_id) === String(senderId)
      ) {
        return {
          insufficient: false,
          noReference: false,
          invalidRecipient: true,
          requested,
          totalBalance: null,
          transfer: null,
        };
      }

      let referenceId = null;
      let totalBalance = 0;

      if (senderRole === "admin") {
        // Lock every open reference so a concurrent admin transfer can't pick
        // the same remaining peso between our read and write.
        await q(
          `SELECT br.reference_id
             FROM budget_reference br
            WHERE br.status = 'open'
            FOR UPDATE`,
          [],
        );

        const pool = (
          await q(
            `SELECT
                COALESCE((
                  SELECT SUM(b.amount)
                    FROM budget b
                    JOIN budget_reference br ON br.reference_id = b.reference_id
                   WHERE br.status = 'open' AND b.status != 'cancelled'
                ), 0)::float8 AS allocated,
                COALESCE((
                  SELECT SUM(ib.amount)
                    FROM budget_issued_reference bir
                    JOIN issued_budget ib ON ib.issued_ref_id = bir.id
                   WHERE bir.status = 'open'
                ), 0)::float8 AS issued,
                COALESCE((
                  SELECT SUM(e.total_amount)
                    FROM expenses e
                   WHERE e.status = 'paid'
                     AND NOT EXISTS (
                       SELECT 1 FROM users u
                        WHERE u.user_id = e.user_id AND u.role = 'employee'
                     )
                ), 0)::float8 AS expenses,
                COALESCE((
                  SELECT SUM(bt.amount)
                    FROM budget_transfer bt
                    JOIN users su ON su.user_id = bt.user_id
                   WHERE bt.status = 'success' AND su.role = 'admin'
                ), 0)::float8 AS admin_sent`,
            [],
          )
        ).rows[0] ?? {};
        totalBalance = toMoney(
          Number(pool.allocated || 0) -
            Number(pool.issued || 0) -
            Number(pool.expenses || 0) -
            Number(pool.admin_sent || 0),
        );

        if (requested > totalBalance) {
          return {
            insufficient: true,
            noReference: false,
            invalidRecipient: false,
            requested,
            totalBalance,
            transfer: null,
          };
        }

        // Oldest reference that can still cover the amount on its own, so a
        // transfer never overspends a single source of funds.
        const covering = (
          await q(
            `SELECT br.reference_id
               FROM budget_reference br
              WHERE br.status = 'open'
                AND (
                  COALESCE((
                    SELECT SUM(b.amount)
                      FROM budget b
                     WHERE b.reference_id = br.reference_id
                       AND b.status != 'cancelled'
                  ), 0)
                  - COALESCE((
                    SELECT SUM(ib.amount)
                      FROM budget_issued_reference bir
                      JOIN issued_budget ib ON ib.issued_ref_id = bir.id
                     WHERE bir.status = 'open'
                       AND bir.reference_id = br.reference_id
                  ), 0)
                  - COALESCE((
                    SELECT SUM(e.total_amount)
                      FROM expenses e
                     WHERE e.reference_id = br.reference_id
                       AND e.status = 'paid'
                       AND NOT EXISTS (
                         SELECT 1 FROM users u
                          WHERE u.user_id = e.user_id AND u.role = 'employee'
                       )
                  ), 0)
                  - COALESCE((
                    SELECT SUM(bt.amount)
                      FROM budget_transfer bt
                      JOIN users su ON su.user_id = bt.user_id
                     WHERE bt.reference_id = br.reference_id
                       AND bt.status = 'success'
                       AND su.role = 'admin'
                  ), 0)
                ) >= $1
              ORDER BY br.created_at ASC
              LIMIT 1`,
            [requested],
          )
        ).rows[0];

        if (!covering) {
          return {
            insufficient: true,
            noReference: false,
            invalidRecipient: false,
            requested,
            totalBalance,
            transfer: null,
          };
        }
        referenceId = covering.reference_id;
      } else {
        // Lock the sender's open issuances for the rest of the transaction so
        // a parallel transfer / expense can't interleave between read and
        // write.
        const locked = await q(
          `SELECT bir.reference_id
             FROM budget_issued_reference bir
            WHERE bir.user_id = $1 AND bir.status = 'open'
            ORDER BY bir.created_at ASC
            FOR UPDATE`,
          [senderId],
        );
        if (locked.rows.length === 0) {
          return {
            insufficient: false,
            noReference: true,
            invalidRecipient: false,
            requested,
            totalBalance: 0,
            transfer: null,
          };
        }
        referenceId = locked.rows[0].reference_id;

        const balance = (
          await q(
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
                ), 0)::float8 AS total_received`,
            [senderId],
          )
        ).rows[0] ?? {};
        totalBalance = toMoney(
          Number(balance.total_budget || 0) +
            Number(balance.total_abono || 0) -
            Number(balance.total_expenses || 0) -
            Number(balance.total_sent || 0) +
            Number(balance.total_received || 0),
        );

        if (requested > totalBalance) {
          return {
            insufficient: true,
            noReference: false,
            invalidRecipient: false,
            requested,
            totalBalance,
            transfer: null,
          };
        }
      }

      const transfer = (
        await q(
          `INSERT INTO budget_transfer
              (reference_id, user_id, amount, notes, method, status, transfer_to)
           VALUES ($1, $2, $3, $4, $5, 'success', $6)
           RETURNING id, reference_id, user_id, amount::float8 AS amount,
                     notes, method, status, transfer_to,
                     created_at, updated_at`,
          [referenceId, senderId, requested, notes ?? null, method, transferTo],
        )
      ).rows[0];

      return {
        insufficient: false,
        noReference: false,
        invalidRecipient: false,
        requested,
        totalBalance,
        transfer,
      };
    });
  }

  // Row lookup for the cancel endpoint. Ownership is enforced in the
  // controller — same pattern as Abono.findById + canTouchRow.
  static async findById(id) {
    const result = await query(
      `SELECT id, reference_id, user_id, amount::float8 AS amount,
              notes, method, status, transfer_to, created_at, updated_at
         FROM budget_transfer
        WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  // Cancel a sent transfer — hard-deletes the `budget_transfer` row in ONE
  // transaction:
  //   1. locks the row and re-checks it is still a successful transfer,
  //   2. re-applies the money rule on the RECIPIENT side: deleting takes the
  //      received amount back OUT of their pool, so when they already spent
  //      it (their balance can't cover the take-back) the cancel resolves
  //      `recipientSpent: true` with nothing deleted — same protection the
  //      abono delete guard gives,
  //   3. deletes the row. The sender's pool grows back by the amount
  //      automatically since sent totals only count existing rows.
  // Resolves `{ notFound, recipientSpent, recipientBalance, transfer }`.
  static async cancelTransfer(id) {
    return withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);

      const locked = (
        await q(
          `SELECT id, user_id, transfer_to, amount::float8 AS amount, status
             FROM budget_transfer
            WHERE id = $1
            FOR UPDATE`,
          [id],
        )
      ).rows[0];

      if (!locked || locked.status !== "success") {
        return {
          notFound: true,
          recipientSpent: false,
          recipientBalance: null,
          transfer: null,
        };
      }

      const amount = toMoney(locked.amount);
      const recipientBalance = (
        await q(
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
              ), 0)::float8 AS total_received`,
          [locked.transfer_to],
        )
      ).rows[0] ?? {};

      const remaining = toMoney(
        Number(recipientBalance.total_budget || 0) +
          Number(recipientBalance.total_abono || 0) -
          Number(recipientBalance.total_expenses || 0) -
          Number(recipientBalance.total_sent || 0) +
          Number(recipientBalance.total_received || 0) -
          amount,
      );

      if (remaining < -0.004) {
        return {
          notFound: false,
          recipientSpent: true,
          recipientBalance: toMoney(
            Number(recipientBalance.total_budget || 0) +
              Number(recipientBalance.total_abono || 0) -
              Number(recipientBalance.total_expenses || 0) -
              Number(recipientBalance.total_sent || 0) +
              Number(recipientBalance.total_received || 0),
          ),
          transfer: null,
        };
      }

      const transfer = (
        await q(
          `DELETE FROM budget_transfer
            WHERE id = $1
            RETURNING id, reference_id, user_id, amount::float8 AS amount,
                      notes, method, status, transfer_to,
                      created_at, updated_at`,
          [id],
        )
      ).rows[0];

      return {
        notFound: false,
        recipientSpent: false,
        recipientBalance: remaining,
        transfer,
      };
    });
  }
}

export default BudgetTransfer;
