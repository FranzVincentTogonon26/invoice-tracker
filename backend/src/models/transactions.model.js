import Budget from "./budget.model.js";
import Expenses from "./expenses.model.js";
import Abono from "./abono.model.js";
import BudgetTransfer from "./budget.transfer.model.js";

// Round to centavos so ledger totals read exactly 0 instead of a
// floating-point residue (same helper every overview model uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Money-flow rules for the unified admin ledger. Every row carries exactly
// one of `moneyIn` / `moneyOut` (the other is 0) plus a `direction` of
// 'in' | 'out' | 'void':
//   - Budget Given (funds allocated into a reference): Money In while the row
//     is live ('added' | 'closed'); a 'cancelled' row is void — it stays
//     visible with its badge but moves no money.
//   - Budget Issued (funds handed from a reference to an employee): Money Out
//     while the parent `budget_issued_reference` is live ('open' | 'close');
//     a 'cancel' parent voids the row.
//   - Expense: Money Out only while 'paid'. Drafts are parked and cancelled
//     rows are void — neither counts as spent.
//   - Abono (out-of-pocket top-up from an employee): Money In while 'open'.
//     Settled (reimbursed) and draft rows no longer fund the pool, so they
//     are void.
//   - Budget Transfer: each `budget_transfer` row is split into its two legs
//     — "Transfer Sent" (Money Out of the sender) and "Transfer Received"
//     (Money In to the recipient). Employee-to-employee moves therefore net
//     to zero at the system level, exactly like the money rules everywhere
//     else; only 'success' rows move money, 'cancel' legs are void but kept
//     for the audit trail.
const budgetGivenFlow = (row) =>
  row.status === "cancelled" ? "void" : "in";

const issuedFlow = (row) => (row.status === "cancel" ? "void" : "out");

const expenseFlow = (row) => (row.status === "paid" ? "out" : "void");

// Abono rows that no longer fund the pool ('settled' | 'draft') are 'void' —
// they stay in the ledger with their status badge but move no money.
const abonoDirection = (row) => (row.status === "open" ? "in" : "void");

const transferLegFlow = (row) => (row.status === "success" ? null : "void");

class Transactions {
  // Unified admin ledger — every money movement in the system in ONE list,
  // newest first. Each source table is read through its existing model method
  // (no duplicated SQL) and normalized to the same row shape the Admin
  // Transactions page renders:
//   { key, kind, id, date, description, notes, amount, moneyIn, moneyOut,
//     direction, status, method, referenceId, referenceLabel, categoryId,
//     categoryName, employeeId, employeeName, employeeRole, employeeAvatar,
//     counterpartyName, counterpartyRole, approvedBy, flagged, expenseDate,
//     dateSettled, receiptId, imageUrl }
// `receiptId` / `imageUrl` mark rows carrying a scanned receipt attachment
// (expenses via `expenses.receipt_id` / `expenses.image_url`, issuances via
// `issued_budget.image_url`) so the ledger can badge them.
  // `kind` is one of 'budget' | 'issued' | 'expense' | 'abono' |
  // 'transfer_sent' | 'transfer_received'. `employeeId` is the account the
  // row is attributed to for the Employee filter (null for system-level
  // Budget Given rows, which carry `approvedBy` text instead).
  // Also returns `summary` (all-time gross Money In / Out / net / counts)
  // and the `categories` + `references` lists the filters are built from.
  static async ledger() {
    const [budgetRows, issuedRows, expensesData, abonoRows, transferRows] =
      await Promise.all([
        Budget.budgetTransaction({}),
        Budget.budgetIssuedTransaction({}),
        Expenses.expensesOverview({}),
        Abono.listAll({}),
        BudgetTransfer.listAll({}),
      ]);

    const transactions = [];

    for (const row of budgetRows ?? []) {
      const amount = toMoney(row.amount);
      const direction = budgetGivenFlow(row);
      transactions.push({
        key: `budget:${row.id}`,
        kind: "budget",
        id: row.id,
        date: row.created_at,
        description: row.description || "Budget allocation",
        notes: null,
        amount,
        moneyIn: direction === "in" ? amount : 0,
        moneyOut: 0,
        direction,
        status: row.status,
        method: row.method ?? null,
        referenceId: row.reference_id ?? null,
        referenceLabel: row.label || "No source of funds",
        categoryId: null,
        categoryName: null,
        employeeId: null,
        employeeName: null,
        employeeRole: null,
        employeeAvatar: null,
        counterpartyName: null,
        counterpartyRole: null,
        approvedBy: row.approved_by ?? null,
        flagged: false,
        expenseDate: null,
        dateSettled: null,
      });
    }

    for (const row of issuedRows ?? []) {
      const amount = toMoney(row.amount);
      const direction = issuedFlow(row);
      transactions.push({
        key: `issued:${row.id}`,
        kind: "issued",
        id: row.id,
        date: row.date_issued,
        description: row.description || "Budget issuance",
        notes: row.notes ?? null,
        amount,
        moneyIn: 0,
        moneyOut: direction === "out" ? amount : 0,
        direction,
        status: row.status,
        method: row.method ?? null,
        referenceId: row.reference_id ?? null,
        referenceLabel: row.source_of_funds || "No source of funds",
        categoryId: null,
        categoryName: null,
        employeeId: row.user_id ?? null,
        employeeName: row.employee ?? null,
        employeeRole: row.employee_role ?? null,
        employeeAvatar: row.avatar_url ?? null,
        counterpartyName: null,
        counterpartyRole: null,
        approvedBy: null,
        flagged: false,
        expenseDate: null,
        dateSettled: null,
        receiptId: null,
        imageUrl: row.image_url ?? null,
      });
    }

    for (const row of expensesData?.expenses ?? []) {
      const amount = toMoney(row.total_amount);
      const direction = expenseFlow(row);
      transactions.push({
        key: `expense:${row.id}`,
        kind: "expense",
        id: row.id,
        date: row.created_at,
        description: row.description || "Expense",
        notes: row.notes ?? null,
        amount,
        moneyIn: 0,
        moneyOut: direction === "out" ? amount : 0,
        direction,
        status: row.status,
        method: row.payment_method ?? null,
        referenceId: row.reference_id ?? null,
        referenceLabel:
          row.reference_label || "No source of funds",
        categoryId: row.category_id ?? null,
        categoryName: row.category_name ?? null,
        employeeId: row.user_id ?? null,
        employeeName: row.created_by ?? null,
        employeeRole: row.created_by_role ?? null,
        employeeAvatar: row.created_by_avatar ?? null,
        counterpartyName: null,
        counterpartyRole: null,
        approvedBy: null,
        flagged: Number(row.flag) === 1,
        expenseDate: row.expense_date ?? null,
        dateSettled: null,
        receiptId: row.receipt_id ?? null,
        imageUrl: row.image_url ?? null,
      });
    }

    for (const row of abonoRows ?? []) {
      const amount = toMoney(row.amount);
      const direction = abonoDirection(row);
      transactions.push({
        key: `abono:${row.id}`,
        kind: "abono",
        id: row.id,
        date: row.created_at,
        description: row.description || "Abono top-up",
        notes: null,
        amount,
        moneyIn: direction === "in" ? amount : 0,
        moneyOut: 0,
        direction,
        status: row.status,
        method: null,
        referenceId: row.reference_id ?? null,
        referenceLabel: row.reference_label || "No source of funds",
        categoryId: null,
        categoryName: null,
        employeeId: row.user_id ?? null,
        employeeName: row.employee_name ?? null,
        employeeRole: "employee",
        employeeAvatar: row.employee_avatar ?? null,
        counterpartyName: null,
        counterpartyRole: null,
        approvedBy: null,
        flagged: false,
        expenseDate: null,
        dateSettled: row.date_settled ?? null,
      });
    }

    for (const row of transferRows ?? []) {
      const amount = toMoney(row.amount);
      const voided = transferLegFlow(row);
      const sentDescription =
        row.notes?.trim() ||
        `Budget transfer to ${row.recipient_name || "employee"}`;
      const receivedDescription =
        row.notes?.trim() ||
        `Budget transfer from ${row.sender_name || "employee"}`;

      transactions.push({
        key: `transfer-sent:${row.id}`,
        kind: "transfer_sent",
        id: row.id,
        date: row.created_at,
        description: sentDescription,
        notes: row.notes ?? null,
        amount,
        moneyIn: 0,
        moneyOut: voided ? 0 : amount,
        direction: voided ?? "out",
        status: row.status,
        method: row.method ?? null,
        referenceId: row.reference_id ?? null,
        referenceLabel: row.reference_label || "No source of funds",
        categoryId: null,
        categoryName: null,
        employeeId: row.sender_id ?? null,
        employeeName: row.sender_name ?? null,
        employeeRole: row.sender_role ?? null,
        employeeAvatar: row.sender_avatar ?? null,
        counterpartyName: row.recipient_name ?? null,
        counterpartyRole: row.recipient_role ?? null,
        approvedBy: null,
        flagged: false,
        expenseDate: null,
        dateSettled: null,
      });

      transactions.push({
        key: `transfer-received:${row.id}`,
        kind: "transfer_received",
        id: row.id,
        date: row.created_at,
        description: receivedDescription,
        notes: row.notes ?? null,
        amount,
        moneyIn: voided ? 0 : amount,
        moneyOut: 0,
        direction: voided ?? "in",
        status: row.status,
        method: row.method ?? null,
        referenceId: row.reference_id ?? null,
        referenceLabel: row.reference_label || "No source of funds",
        categoryId: null,
        categoryName: null,
        employeeId: row.recipient_id ?? null,
        employeeName: row.recipient_name ?? null,
        employeeRole: row.recipient_role ?? null,
        employeeAvatar: row.recipient_avatar ?? null,
        counterpartyName: row.sender_name ?? null,
        counterpartyRole: row.sender_role ?? null,
        approvedBy: null,
        flagged: false,
        expenseDate: null,
        dateSettled: null,
      });
    }

    transactions.sort((a, b) => {
      const ta = new Date(a.date ?? 0).getTime() || 0;
      const tb = new Date(b.date ?? 0).getTime() || 0;
      return tb - ta;
    });

    // All-time gross figures — the stat cards' starting point. Filtered views
    // re-sum the visible rows client-side so every number on screen always
    // adds up to the table below it.
    const summary = {
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
      count: transactions.length,
      byKind: {},
    };
    for (const tx of transactions) {
      summary.moneyIn = toMoney(summary.moneyIn + tx.moneyIn);
      summary.moneyOut = toMoney(summary.moneyOut + tx.moneyOut);
      summary.byKind[tx.kind] = (summary.byKind[tx.kind] ?? 0) + 1;
    }
    summary.net = toMoney(summary.moneyIn - summary.moneyOut);

    return {
      transactions,
      summary,
      categories: expensesData?.categories ?? [],
      references: expensesData?.references ?? [],
    };
  }
}

export default Transactions;
