import { query } from "../config/db.js";

// Round to centavos so a fully-spent balance reads exactly 0 instead of a
// floating-point residue (same helper the expenses model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Per-employee overview aggregates — every figure is scoped to the logged-in
// user's `user_id` (passed in from the auth middleware via the controller).
//   - totalBudget:   SUM(issued_budget.amount) through the employee's OPEN
//                    budget_issued_reference rows ("Total Budget Issued")
//   - totalExpenses: SUM(expenses.total_amount) of PAID rows only, and only
//                    while the employee still holds an OPEN issuance for the
//                    row's source (untagged rows always count). A soft-deleted
//                    row is parked in 'draft' and a voided one sits in 'cancel'
//                    (see the row actions), so neither may read as spent here.
//                    The transaction feed below still LISTS every status — and
//                    keeps listing closed-holding history too — which is exactly
//                    why these totals stay gated instead of following the list.
//   - totalAbono:    SUM(employee_abono.amount) of OPEN rows only, holding-
//                    gated like expenses: a settled (reimbursed) or draft
//                    (parked) abono never funds spending, and abono under a
//                    closed holding drops out of the hero (its rows stay
//                    listed in the feed).
//   - totalBalance:  what the employee can still spend
//                    (issued + OPEN abono − PAID expenses − sent transfers +
//                    received transfers). Only 'success' transfers move money —
//                    a 'cancel' row is an audit trail and never counts.
// Counts ride along so the cards can show "N references / N transactions"
// captions without a second round-trip. One query, all scalar subqueries.
class EmployeeOverview {
  static async employeeOverview(
    userId,
    { search, issuedRefId, openOnly } = {},
  ) {
    // Record-scoped view (`…/employees/:birId/reimbursement`, `view =
    // 'reimbursement'`): every figure is keyed on ONE
    // `budget_issued_reference.id` via each child table's `issued_ref_id` —
    // NOT on `user_id` + `reference_id`. This is the fix the
    // AdminEmployeesDetails page needs: an employee can hold several issuance
    // records (different sources, or reopened holdings), and joining only by
    // user would mix them. When `issuedRefId` is present the hero sums and
    // the feed below all filter by it; otherwise the whole-account behaviour
    // applies.
    if (issuedRefId) {
      return this.employeeOverviewByIssuedRef(userId, issuedRefId, { search });
    }
    // Overview view (`…/employees/:userId/overview`, `view = 'overview'`):
    // `openOnly` keys the whole page on the user's OPEN holdings
    // (`budget_issued_reference.status = 'open'`) — closed holdings leave no
    // footsteps in sums OR lists. Defaults off so the employee-facing pages
    // (which keep closed-holding history visible) never change.
    // Closed sources leave no footsteps, and closed holdings stop funding
    // the hero: every money sum below only counts rows under an open source
    // through an OPEN holding (untagged expenses excepted). The feed legs
    // filter lighter on purpose — closed-holding spent/abono history stays
    // listed (see each leg). Untagged expenses (reference_id IS NULL)
    // connect to no source and stay visible everywhere.
    const statsResult = await query(
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
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.user_id = $1 AND bir.status = 'open'
              AND br.status = 'open'
          ), 0)::int AS active_references,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
              -- Holding-gated: a tagged expense only counts while the
              -- employee still holds an OPEN issuance for its source. Once
              -- the holding closes, the line leaves the feed AND the hero
              -- together. Untagged lines connect to no holding and always
              -- count. Pinned to the expense's own holding when stamped
              -- (new saves carry issued_ref_id); legacy NULL rows fall back
              -- to any open holding for the source.
              AND (e.reference_id IS NULL OR EXISTS (
                SELECT 1
                  FROM budget_issued_reference bir2
                 WHERE bir2.user_id = e.user_id
                   AND bir2.reference_id = e.reference_id
                   AND bir2.status = 'open'
                   AND (e.issued_ref_id IS NULL OR bir2.id = e.issued_ref_id)
              ))
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT COUNT(*)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
              -- Same holding gate as total_expenses: the hero caption must
              -- count exactly the lines the total sums.
              AND (e.reference_id IS NULL OR EXISTS (
                SELECT 1
                  FROM budget_issued_reference bir2
                 WHERE bir2.user_id = e.user_id
                   AND bir2.reference_id = e.reference_id
                   AND bir2.status = 'open'
                   AND (e.issued_ref_id IS NULL OR bir2.id = e.issued_ref_id)
              ))
          ), 0)::int AS expense_count,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.user_id = $1 AND ea.status = 'open'
              AND br.status = 'open'
              -- Holding-gated like expenses above: open abono only funds
              -- the hero while its source holding is still open. Closed
              -- holdings keep their abono rows listed in the feed.
              AND EXISTS (
                SELECT 1
                  FROM budget_issued_reference bir2
                 WHERE bir2.user_id = ea.user_id
                   AND bir2.reference_id = ea.reference_id
                   AND bir2.status = 'open'
              )
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT COUNT(*)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.user_id = $1
              AND br.status = 'open'
          ), 0)::int AS abono_count,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            ${openOnly ? "JOIN budget_issued_reference birf ON birf.id = bt.issued_ref_id AND birf.status = 'open' AND birf.user_id = bt.user_id" : ""}
            WHERE bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          COALESCE((
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = $1 AND btr.status = 'success'
          ), 0)::float8 AS total_received`,
      [userId],
    );

    const row = statsResult.rows[0] ?? {};
    const totalBudget = toMoney(row.total_budget);
    const totalExpenses = toMoney(row.total_expenses);
    const totalAbono = toMoney(row.total_abono);
    const totalSent = toMoney(row.total_sent);
    const totalReceived = toMoney(row.total_received);

    // Fetch individual transactions for this employee across issued budget,
    // expenses, abono, and budget transfers (success only — transfers complete
    // or not at all, so there is no draft state to list). Abono rows carry
    // `date_settled` so the details sheet can show when a settled abono was
    // closed out (other kinds carry NULL). Transfer rows carry `direction`
    // ('sent' | 'received') and the other party's name as `counterparty`.
    const txParams = [userId];
    let searchFilter = "";
    if (search && search.trim()) {
      txParams.push(`%${search.trim()}%`);
      searchFilter = `WHERE (
        t.description ILIKE $2
        OR t.reference_label ILIKE $2
        OR t.method ILIKE $2
        OR t.status ILIKE $2
        OR t.notes ILIKE $2
        OR t.kind ILIKE $2
        OR t.direction ILIKE $2
        OR t.counterparty ILIKE $2
      )`;
    }

    // Overview view (`openOnly`): closed holdings leave the feed too, so the
    // list can never disagree with the open-only hero above. Default feeds
    // keep closed-holding history visible (employee pages rely on it).
    const openHoldingGate = openOnly ? "AND bir.status = 'open'" : "";
    const txQuery = `
      WITH all_tx AS (
        -- 1. Budget Issued transactions (open sources only — holdings under
        --    a cut-off source leave no footsteps here). Closed holdings list
        --    by default (history stays visible); openOnly (overview view)
        --    hides them so the list matches the open-only hero. The hero
        --    total above is always open-holding-gated. issued_ref_id is the
        --    issuance record id.
        SELECT
          ib.id,
          'issued' AS kind,
          ib.amount::float8 AS amount,
          ib.description,
          ib.notes,
          ib.method,
          -- Validate against the issued_budget row itself: 'added' (live)
          -- vs 'cancel' (void). The parent bir.status ('open'/'close')
          -- must NOT be used here or a cancelled issuance would still read
          -- as live and never get its danger badge + struck amount.
          ib.status,
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          bir.reference_id,
          bir.id AS issued_ref_id,
          0 AS flag,
          ib.created_at AS date,
          ib.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM issued_budget ib
        JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
        JOIN budget_reference br ON br.reference_id = bir.reference_id
          AND br.status = 'open'
        WHERE bir.user_id = $1
          ${openHoldingGate}

        UNION ALL

        -- 2. Expense transactions — EVERY status is listed (paid / draft /
        --    cancel) so the ledger shows the full live record, but ONLY while
        --    the employee still holds an OPEN issuance for the line's source:
        --    spent lines from a CLOSED holding are hidden here together with
        --    the hero totals (same holding gate as total_expenses above, so
        --    the two can never disagree). Rows tagged to a cut-off source are
        --    hidden; untagged rows stay.
        SELECT
          e.id,
          'expense' AS kind,
          e.total_amount::float8 AS amount,
          e.description,
          COALESCE(e.notes, c.category_name) AS notes,
          e.payment_method AS method,
          e.status,
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          e.reference_id,
          e.issued_ref_id,
          e.flag AS flag,
          e.created_at AS date,
          e.created_at AS created_at,
          e.receipt_id,
          e.image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM expenses e
        LEFT JOIN category c ON c.category_id = e.category_id
        LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
        WHERE e.user_id = $1
          AND (e.reference_id IS NULL OR br.status = 'open')
          -- Display gate: tagged lines list only while their holding is
          -- still OPEN (pinned to the line's own issued_ref_id when stamped,
          -- legacy NULL rows fall back to any open holding for the source).
          AND (e.reference_id IS NULL OR EXISTS (
            SELECT 1
              FROM budget_issued_reference bir2
             WHERE bir2.user_id = e.user_id
               AND bir2.reference_id = e.reference_id
               AND bir2.status = 'open'
               AND (e.issued_ref_id IS NULL OR bir2.id = e.issued_ref_id)
          ))

        UNION ALL

        -- 3. Abono transactions (open sources only — including rows whose
        --    holding has since closed; abono keeps full history while only
        --    open-holding rows fund the hero total above). openOnly
        --    (overview view) hides closed-holding rows too.
        SELECT
          ea.id,
          'abono' AS kind,
          ea.amount::float8 AS amount,
          ea.description,
          NULL AS notes,
          'cash' AS method,
          ea.status,
          ea.date_settled,
          br.label AS reference_label,
          ea.reference_id,
          ea.issued_ref_id,
          0 AS flag,
          ea.created_at AS date,
          ea.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM employee_abono ea
        JOIN budget_reference br ON br.reference_id = ea.reference_id
          AND br.status = 'open'
        WHERE ea.user_id = $1
          ${openOnly ? "AND EXISTS (SELECT 1 FROM budget_issued_reference bir2 WHERE bir2.user_id = ea.user_id AND bir2.reference_id = ea.reference_id AND bir2.status = 'open' AND (ea.issued_ref_id IS NULL OR bir2.id = ea.issued_ref_id))" : ""}

        UNION ALL

        -- 4. Budget transfers sent — money leaving this employee's pool
        --    (open sources only). openOnly (overview view) counts only moves
        --    funded by an OPEN holding (joined through issued_ref_id).
        SELECT
          bt.id,
          'transfer' AS kind,
          bt.amount::float8 AS amount,
          COALESCE(
            NULLIF(TRIM(bt.notes), ''),
            'Budget transfer to ' || COALESCE(ru.name, 'employee')
          ) AS description,
          bt.notes,
          bt.method,
          bt.status,
          NULL::timestamptz AS date_settled,
          NULL AS reference_label,
          bt.reference_id,
          bt.issued_ref_id,
          0 AS flag,
          bt.created_at AS date,
          bt.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          'sent' AS direction,
          ru.name AS counterparty
        FROM budget_transfer bt
        LEFT JOIN users ru ON ru.user_id = bt.transfer_to
        ${openOnly ? "JOIN budget_issued_reference birf ON birf.id = bt.issued_ref_id AND birf.status = 'open' AND birf.user_id = bt.user_id" : ""}
        WHERE bt.user_id = $1 AND bt.status = 'success'

        UNION ALL

        -- 5. Budget transfers received — money entering this employee's pool
        --    (open sources only).
        SELECT
          bt.id,
          'transfer' AS kind,
          bt.amount::float8 AS amount,
          COALESCE(
            NULLIF(TRIM(bt.notes), ''),
            'Budget transfer from ' || COALESCE(su.name, 'employee')
          ) AS description,
          bt.notes,
          bt.method,
          bt.status,
          NULL::timestamptz AS date_settled,
          NULL AS reference_label,
          bt.reference_id,
          bt.issued_ref_id,
          0 AS flag,
          bt.created_at AS date,
          bt.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          'received' AS direction,
          su.name AS counterparty
        FROM budget_transfer bt
        LEFT JOIN users su ON su.user_id = bt.user_id
        WHERE bt.transfer_to = $1 AND bt.status = 'success'
      )
      SELECT * FROM all_tx t
      ${searchFilter}
      -- Newest first by when the record was ADDED — not by the business date
      -- an expense was booked for. One merge across issued/expense/abono and
      -- transfers, so a row entered today always sits above anything older,
      -- whatever table it came from. The date column stays the displayed (and
      -- date-filtered) value.
      ORDER BY t.created_at DESC NULLS LAST, t.date DESC
    `;

    const txResult = await query(txQuery, txParams);

    return {
      totalBudget,
      totalExpenses,
      totalAbono,
      totalSent,
      totalReceived,
      totalBalance: toMoney(
        totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
      ),
      activeReferences: Number(row.active_references) || 0,
      expenseCount: Number(row.expense_count) || 0,
      abonoCount: Number(row.abono_count) || 0,
      transactions: txResult.rows,
    };
  }

  // Single-issuance overview — all money legs keyed on
  // `budget_issued_reference.id` (`issued_ref_id`). Used when
  // AdminEmployeesDetails opens with a bir-id (`/admin/employees/:birId`).
  // Source gating stays (a cut-off source connects to nothing), but the
  // holding gate is dropped: the record shows its own live money even after
  // it is closed, matching the reimbursement per-record view. Received
  // transfers are excluded — they carry the SENDER's `issued_ref_id`, never
  // this record's — so the balance is issued + abono − spent − sent.
  static async employeeOverviewByIssuedRef(userId, issuedRefId, { search } = {}) {
    const statsResult = await query(
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
            SELECT COUNT(*)
            FROM budget_issued_reference bir
            JOIN budget_reference br ON br.reference_id = bir.reference_id
            WHERE bir.id = $2 AND bir.user_id = $1
              AND bir.status = 'open'
              AND br.status = 'open'
          ), 0)::int AS active_references,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.issued_ref_id = $2 AND e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
          ), 0)::float8 AS total_expenses,
          COALESCE((
            SELECT COUNT(*)
            FROM expenses e
            LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
            WHERE e.issued_ref_id = $2 AND e.user_id = $1 AND e.status = 'paid'
              AND (e.reference_id IS NULL OR br.status = 'open')
          ), 0)::int AS expense_count,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.issued_ref_id = $2 AND ea.user_id = $1 AND ea.status = 'open'
              AND br.status = 'open'
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT COUNT(*)
            FROM employee_abono ea
            JOIN budget_reference br ON br.reference_id = ea.reference_id
            WHERE ea.issued_ref_id = $2 AND ea.user_id = $1
              AND br.status = 'open'
          ), 0)::int AS abono_count,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            WHERE bt.issued_ref_id = $2 AND bt.user_id = $1 AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          0::float8 AS total_received`,
      [userId, issuedRefId],
    );

    const row = statsResult.rows[0] ?? {};
    const totalBudget = toMoney(row.total_budget);
    const totalExpenses = toMoney(row.total_expenses);
    const totalAbono = toMoney(row.total_abono);
    const totalSent = toMoney(row.total_sent);
    const totalReceived = 0;

    const txParams = [userId, issuedRefId];
    let searchFilter = "";
    if (search && search.trim()) {
      txParams.push(`%${search.trim()}%`);
      searchFilter = `WHERE (
        t.description ILIKE $3
        OR t.reference_label ILIKE $3
        OR t.method ILIKE $3
        OR t.status ILIKE $3
        OR t.notes ILIKE $3
        OR t.kind ILIKE $3
        OR t.direction ILIKE $3
        OR t.counterparty ILIKE $3
      )`;
    }

    const txQuery = `
      WITH all_tx AS (
        SELECT
          ib.id,
          'issued' AS kind,
          ib.amount::float8 AS amount,
          ib.description,
          ib.notes,
          ib.method,
          ib.status,
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          bir.reference_id,
          bir.id AS issued_ref_id,
          0 AS flag,
          ib.created_at AS date,
          ib.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM issued_budget ib
        JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
        JOIN budget_reference br ON br.reference_id = bir.reference_id
          AND br.status = 'open'
        WHERE bir.id = $2 AND bir.user_id = $1

        UNION ALL

        SELECT
          e.id,
          'expense' AS kind,
          e.total_amount::float8 AS amount,
          e.description,
          COALESCE(e.notes, c.category_name) AS notes,
          e.payment_method AS method,
          e.status,
          NULL::timestamptz AS date_settled,
          br.label AS reference_label,
          e.reference_id,
          e.issued_ref_id,
          e.flag AS flag,
          e.created_at AS date,
          e.created_at AS created_at,
          e.receipt_id,
          e.image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM expenses e
        LEFT JOIN category c ON c.category_id = e.category_id
        LEFT JOIN budget_reference br ON br.reference_id = e.reference_id
        WHERE e.issued_ref_id = $2 AND e.user_id = $1
          AND (e.reference_id IS NULL OR br.status = 'open')

        UNION ALL

        SELECT
          ea.id,
          'abono' AS kind,
          ea.amount::float8 AS amount,
          ea.description,
          NULL AS notes,
          'cash' AS method,
          ea.status,
          ea.date_settled,
          br.label AS reference_label,
          ea.reference_id,
          ea.issued_ref_id,
          0 AS flag,
          ea.created_at AS date,
          ea.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          NULL AS direction,
          NULL AS counterparty
        FROM employee_abono ea
        JOIN budget_reference br ON br.reference_id = ea.reference_id
          AND br.status = 'open'
        WHERE ea.issued_ref_id = $2 AND ea.user_id = $1

        UNION ALL

        SELECT
          bt.id,
          'transfer' AS kind,
          bt.amount::float8 AS amount,
          COALESCE(
            NULLIF(TRIM(bt.notes), ''),
            'Budget transfer to ' || COALESCE(ru.name, 'employee')
          ) AS description,
          bt.notes,
          bt.method,
          bt.status,
          NULL::timestamptz AS date_settled,
          NULL AS reference_label,
          bt.reference_id,
          bt.issued_ref_id,
          0 AS flag,
          bt.created_at AS date,
          bt.created_at AS created_at,
          NULL AS receipt_id,
          NULL AS image_url,
          'sent' AS direction,
          ru.name AS counterparty
        FROM budget_transfer bt
        LEFT JOIN users ru ON ru.user_id = bt.transfer_to
        WHERE bt.issued_ref_id = $2 AND bt.user_id = $1 AND bt.status = 'success'
      )
      SELECT * FROM all_tx t
      ${searchFilter}
      ORDER BY t.created_at DESC NULLS LAST, t.date DESC
    `;

    const txResult = await query(txQuery, txParams);

    return {
      totalBudget,
      totalExpenses,
      totalAbono,
      totalSent,
      totalReceived,
      totalBalance: toMoney(
        totalBudget + totalAbono - totalExpenses - totalSent + totalReceived,
      ),
      activeReferences: Number(row.active_references) || 0,
      expenseCount: Number(row.expense_count) || 0,
      abonoCount: Number(row.abono_count) || 0,
      transactions: txResult.rows,
    };
  }
}

export default EmployeeOverview;
