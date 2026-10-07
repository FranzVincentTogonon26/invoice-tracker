import { ArrowLeftRight, Layers } from "lucide-react";
import { OVERVIEW_TYPE_CONFIG, OVERVIEW_TYPE_ITEM_TITLE } from "@/constants";
import {
  addDays,
  isSameDay,
  matchesDayRange,
  methodLabel,
  startOfDay,
  toDate,
} from "@/lib/utils";

// Short "20 Oct" date for the compact mobile meta row. Falls back to the
// full `formatDate` for valid non-midnight timestamps only when parsing
// fails entirely — invalid dates render as "—", never "Invalid Date".
export const formatShortDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

// `expenses.flag = 1` means the backend saved this employee line as backdated
// (dated before the first budget issued to them). Accepts both the raw `flag`
// column and the mapped `flagged` boolean so desktop + mobile render from any
// shape the overview passes in. Only `expense` rows can ever be flagged —
// issued/abono always carry `flag = 0`.
export const isFlagged = (row) =>
  row?.flagged === true || Number(row?.flag) === 1;

// Budget-transfer rows (kind "transfer", success only): `direction` is 'sent'
// (this employee moved money out) or 'received' (money moved in). Only
// `expense` and sent-transfer rows can ever read negative — issued/abono and
// received transfers always carry `flag = 0` too.
export const isTransfer = (row) => row?.kind === "transfer";
export const isSentTransfer = (row) =>
  isTransfer(row) && row?.direction === "sent";
export const isNegative = (row) =>
  row?.kind === "expense" || isSentTransfer(row);

// "To <name>" / "From <name>" second line for transfer rows.
export const transferCounterparty = (row) =>
  isTransfer(row) && row?.counterparty
    ? `${isSentTransfer(row) ? "To" : "From"} ${row.counterparty}`
    : "";

// Expense rows the ledger labels with their OWN status badge: a soft-deleted
// row is parked in 'draft' and a voided one sits in 'cancel' (see the row
// actions). Paid rows keep the plain type badge, and issued/abono rows have
// their own badges — only these two statuses get an identifying badge.
export const isDraftOrCancelled = (row) =>
  row?.kind === "expense" &&
  (row?.status === "draft" || row?.status === "cancel");

// A cancelled row never counts toward any total — strike its amount so it
// reads as void at a glance.
export const isCancelled = (row) =>
  row?.kind === "expense" && row?.status === "cancel";

// A cancelled issuance no longer funds the employee — mark it with a danger
// "Cancelled" badge and strike its amount, but leave every tone alone: row,
// badge family and amount color stay exactly as a live row renders.
export const isCancelledIssued = (row) =>
  row?.kind === "issued" && row?.status === "cancel";

// Draft expenses read warning-toned; cancelled rows danger-toned — the same
// status colors their badges use, so the row and badge speak one language.
export const isDraftExpense = (row) =>
  row?.kind === "expense" && row?.status === "draft";

// Ledger TYPE badge (the "Type" column): pure kind + transfer-direction
// mapping — never status. Draft / cancelled / settled states stay in the
// Status column, so the two columns can't contradict each other:
//   - issued (live or cancelled) → "Budget Received" (accent, money in)
//   - expense (paid, draft or cancelled) → "Expenses" (neutral)
//   - transfer sent → "Transfer Budget" (neutral; the danger amount already
//     signals money-out, mirroring the sheet's neutral "Sent")
//   - transfer received → "Received Budget Transfer" (success, money in,
//     mirroring the sheet's success "Received")
//   - abono (open, settled or draft) → "Abono" (warning, the universal
//     abono tone; settled state stays in the Status column)
export const getTypeBadge = (row) => {
  if (isTransfer(row)) {
    return isSentTransfer(row)
      ? { label: "Transfer Budget", tone: "neutral", Icon: ArrowLeftRight }
      : {
          label: "Received Budget Transfer",
          tone: "success",
          Icon: ArrowLeftRight,
        };
  }
  switch (row?.kind) {
    case "issued":
      return {
        label: "Budget Received",
        tone: "accent",
        Icon: OVERVIEW_TYPE_CONFIG.issued.Icon,
      };
    case "expense":
      return {
        label: "Expenses",
        tone: "neutral",
        Icon: OVERVIEW_TYPE_CONFIG.expense.Icon,
      };
    case "abono":
      return {
        label: "Abono",
        tone: "warning",
        Icon: OVERVIEW_TYPE_CONFIG.abono.Icon,
      };
    default:
      return {
        label: OVERVIEW_TYPE_CONFIG[row?.kind]?.label ?? "Other",
        tone: "neutral",
        Icon: Layers,
      };
  }
};

export const overviewConfigFor = (kind) =>
  OVERVIEW_TYPE_CONFIG[kind] ?? OVERVIEW_TYPE_CONFIG.expense;

// Detail-view title for a transaction, shared by the mobile sheet and the
// desktop dialog so both headers read identically: by item type
// (Budget / Expenses / Abono / Transfer), except a received transfer which
// reads "Budget Received" since money came in.
export const overviewTitle = (row, meta) =>
  row?.kind === "transfer" && row?.direction === "received"
    ? "Budget Received"
    : (OVERVIEW_TYPE_ITEM_TITLE[row?.kind] ?? meta?.label ?? "Transaction");

// An expense carrying a receipt — links a receipt record or carries a stored
// receipt file. Accepts both the feed's snake_case fields and the modal's
// camelCase shape.
export const hasOverviewReceipt = (row) =>
  row?.kind === "expense" &&
  Boolean(
    row.receiptId ?? row.receipt_id ?? row.imageUrl ?? row.image_url,
  );

// The overview feed uses snake_case receipt fields while
// EmployeeExpenseDetailsModal reads camelCase — normalize before handing a
// row over so the receipt UI detects the attachment.
export const toExpenseModalRow = (row) =>
  row
    ? {
        ...row,
        receiptId: row.receiptId ?? row.receipt_id ?? null,
        imageUrl: row.imageUrl ?? row.image_url ?? "",
        flagged: row.flagged ?? row.flag,
      }
    : row;

export const getDateGroupLabel = (date) => {
  // Unparseable dates render "—" instead of silently falling into Today
  // (startOfDay falls back to now for nullish input).
  if (!toDate(date)) return "—";
  const txDate = startOfDay(toDate(date));
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  if (isSameDay(txDate, today)) return "Today";
  if (isSameDay(txDate, yesterday)) return "Yesterday";
  return "Last days";
};

export const groupTransactionsByDate = (rows) => {
  const groups = new Map();
  const groupOrder = ["Today", "Yesterday", "Last days"];

  for (const tx of rows) {
    const label = getDateGroupLabel(tx.date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(tx);
  }

  return groupOrder
    .filter((label) => groups.has(label) && groups.get(label).length > 0)
    .map((label) => ({ label, transactions: groups.get(label) }));
};

// The feed merges four sources, so never trust the incoming order: newest
// record first — by when it was ADDED (`created_at`). An expense booked for
// an older date still belongs on top when it was entered today.
export const sortOverviewByAdded = (transactions) => {
  const addedAt = (tx) => toDate(tx.created_at)?.getTime() ?? 0;
  return [...(transactions ?? [])].sort((a, b) => addedAt(b) - addedAt(a));
};

export const filterOverviewTransactions = (
  sorted,
  debouncedSearch,
  dateRange,
) => {
  const q = debouncedSearch.trim().toLowerCase();
  const { start, end } = dateRange ?? {};
  const inRange = (tx) => matchesDayRange(tx.date, start, end);
  if (!q) return sorted.filter(inRange);
  return sorted.filter((tx) => {
    if (!inRange(tx)) return false;
    const typeLabel =
      OVERVIEW_TYPE_CONFIG[tx.kind]?.label?.toLowerCase() || "";
    const typeBadgeLabel = getTypeBadge(tx).label.toLowerCase();
    const desc = (tx.description || "").toLowerCase();
    const refLabel = (tx.reference_label || "").toLowerCase();
    const notes = (tx.notes || "").toLowerCase();
    const method = methodLabel(tx.method || "").toLowerCase();
    const status = (tx.status || "").toLowerCase();
    const direction = (tx.direction || "").toLowerCase();
    const counterparty = (tx.counterparty || "").toLowerCase();
    const amountStr = String(tx.amount || "");

    return (
      desc.includes(q) ||
      refLabel.includes(q) ||
      notes.includes(q) ||
      typeLabel.includes(q) ||
      typeBadgeLabel.includes(q) ||
      method.includes(q) ||
      status.includes(q) ||
      direction.includes(q) ||
      counterparty.includes(q) ||
      amountStr.includes(q)
    );
  });
};
