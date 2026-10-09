import { formatMoney } from "@/lib/utils";

// ── Reimbursement review helpers ─────────────────────────────────────────────
// Pure, UI-free logic for the admin reimbursement review flow (see
// components/layout/admin/reimbursement/ReviewSection.jsx). Kept here so the
// rules are testable without rendering and reusable by any consumer.

/**
 * Newest-first copy of an expense-ledger row list, so refetches and toggles
 * can never reshuffle the list out from under the checkboxes.
 */
export function sortExpensesNewestFirst(expenses) {
  return [...(expenses ?? [])].sort(
    (a, b) =>
      (new Date(b.created_at ?? b.expense_date).getTime() || 0) -
      (new Date(a.created_at ?? a.expense_date).getTime() || 0),
  );
}

/**
 * Review counters for an expense-ledger row list:
 * `{ total, checked, pending, flagged, pct }`.
 */
export function getReviewProgress(expenses) {
  const rows = expenses ?? [];
  const total = rows.length;
  const checked = rows.filter((e) => e.review === "yes").length;
  const pending = total - checked;
  const flagged = rows.filter((e) => Number(e.flag) === 1).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  return { total, checked, pending, flagged, pct };
}

/**
 * Data-driven reimbursement tips — `[{ key, tone, text }]` with
 * `tone: "warning" | "danger" | "success"`. Callers map tone → icon.
 */
export function buildReviewTips({
  pending,
  total,
  flagged,
  openAbono,
  balance,
}) {
  const list = [];
  if (pending > 0)
    list.push({
      key: "pending",
      tone: "warning",
      text: `${pending} of ${total} still unreviewed — work oldest first.`,
    });
  if (flagged > 0)
    list.push({
      key: "flagged",
      tone: "danger",
      text: `${flagged} flagged ${flagged === 1 ? "line needs" : "lines need"} approval before any reimbursement.`,
    });
  if (Number(openAbono) > 0)
    list.push({
      key: "abono",
      tone: "warning",
      text: `${formatMoney(openAbono)} open abono still held — settle before reimbursing.`,
    });
  if (Number(balance) < 0)
    list.push({
      key: "overdrawn",
      tone: "danger",
      text: `Overdrawn by ${formatMoney(Math.abs(Number(balance)))} — hold reimbursement.`,
    });
  if (list.length === 0)
    list.push({
      key: "clear",
      tone: "success",
      text: "All clear — every transaction reviewed. Safe to proceed.",
    });
  return list;
}

/**
 * Cent-safe sum of a row list's `amount` fields.
 */
export function sumRowAmounts(rows) {
  return (
    Math.round(
      (rows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100,
    ) / 100
  );
}

/**
 * Settlement shortfall: how much `requested` exceeds `coverBalance`,
 * cent-rounded. Callers only use it when the request is actually
 * under-covered (it goes negative otherwise).
 */
export function computeShortfall(requested, coverBalance) {
  return Math.round((Number(requested) - Number(coverBalance)) * 100) / 100;
}

/**
 * Distinct budget sources behind open abono rows, keyed by `reference_id`:
 * `[{ reference_id, label }]`, first-seen order.
 */
export function distinctSourcesByReference(openRows) {
  const seen = new Map();
  for (const r of openRows ?? []) {
    if (!r.reference_id || seen.has(r.reference_id)) continue;
    seen.set(r.reference_id, r.reference_label || "Untitled reference");
  }
  return [...seen.entries()].map(([reference_id, label]) => ({
    reference_id,
    label,
  }));
}

/**
 * Shape an employee-ledger row into what ExpenseDetailsModal reads
 * (receipt image/PDF, itemized lines, flag tools).
 */
export function toExpenseModalRow(e) {
  return {
    id: e.id,
    description: e.description,
    category: e.category_name,
    timeDate: e.created_at,
    date: e.expense_date,
    amount: Number(e.total_amount) || 0,
    method: e.payment_method,
    status: e.status,
    flagged: Number(e.flag) === 1,
    notes: e.notes,
    referenceId: e.reference_id,
    sourceOfFunds: e.reference_label || "No source of funds",
    receiptId: e.receipt_id,
    imageUrl: e.image_url,
    receiptDate: e.receipt_date,
    employee: e.created_by,
    employeeRole: e.created_by_role,
    employeeAvatar: e.created_by_avatar,
  };
}
