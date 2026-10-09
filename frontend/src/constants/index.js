import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";

export const USER_ROLES = { ADMIN: "admin", EMPLOYEE: "employee" };
export const EXPENSE_STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "cancel", label: "Cancelled" },
];
export const EXPENSE_FILTER_KEYS = ["employee", "category", "method", "status"];
export const EXPENSE_LEDGER_STATUS_META = {
  paid: { tone: "success", label: "Paid" },
  draft: { tone: "warning", label: "Draft" },
  cancel: { tone: "danger", label: "Cancelled" },
};
export const EXPENSE_LEDGER_STATUS_ORDER = ["paid", "draft", "cancel"];

// Unified ledger kinds (Admin Transactions) — badge tone, label and icon per
// kind. Plain references (no JSX), so ledger tables, details modals and the
// command-palette-style filters can share one source of truth.
export const TRANSACTION_KIND_META = {
  budget: { tone: "neutral", label: "Budget Given", Icon: Plus },
  issued: { tone: "accent", label: "Budget Issued", Icon: HandCoins },
  expense: { tone: "warning", label: "Expense", Icon: ReceiptText },
  abono: { tone: "success", label: "Abono", Icon: Wallet },
  transfer_sent: {
    tone: "danger",
    label: "Transfer Sent",
    Icon: ArrowLeftRight,
  },
  transfer_received: {
    tone: "success",
    label: "Transfer Received",
    Icon: ArrowLeftRight,
  },
};
export const TRANSACTION_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "budget", label: "Budget Given" },
  { value: "issued", label: "Budget Issued" },
  { value: "expense", label: "Expenses" },
  { value: "abono", label: "Abono" },
  { value: "transfer", label: "Transfers" },
];
export const TRANSACTION_DIRECTION_OPTIONS = [
  { value: "all", label: "All flows" },
  { value: "in", label: "Money In" },
  { value: "out", label: "Money Out" },
  { value: "void", label: "No movement" },
];
export const TRANSACTION_FILTER_KEYS = [
  "direction",
  "employee",
  "reference",
  "category",
  "status",
];
export const SYSTEM_EMPLOYEE_VALUE = "__system";
export const SOURCE_STATUS = {
  open: { tone: "success", label: "Open" },
  cut_off: { tone: "danger", label: "Closed" },
};
export const SOURCE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "cut_off", label: "Closed" },
];
export const SOURCE_EDIT_STATUS_OPTIONS = [
  { value: "open", label: "Open — accepts activity" },
  { value: "cut_off", label: "Closed — disconnected" },
];
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "e_wallet", label: "E-Wallet" },
];
export const BUDGET_STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "added", label: "Added" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
];
export const STATUS = {
  closed: { tone: "accent", label: "Closed" },
  sent: { tone: "accent", label: "Sent" },
  paid: { tone: "success", label: "Paid" },
  overdue: { tone: "danger", label: "Overdue" },
  pending: { tone: "warning", label: "Pending" },
  added: { tone: "accent", label: "Added" },
  cancelled: { tone: "danger", label: "Cancelled" },
  draft: { tone: "warning", label: "Draft" },
  settled: { tone: "success", label: "Settled" },
  success: { tone: "success", label: "Success" },
  open: { tone: "warning", label: "Open" },
  cancel: { tone: "danger", label: "Cancelled" },
  close: { tone: "accent", label: "Closed" },
  active: { tone: "success", label: "Active" },
  inactive: { tone: "neutral", label: "Inactive" },
};
export const ERROR_VISIBLE_MS = 5000;
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_LABEL = "10MB";
export const MODAL_COPY = {
  category: {
    title: "Expense Categories",
    description:
      "Manage the buckets expense lines are filed under. New categories show up in the form instantly.",
    maxWidth: "max-w-[660px]",
  },
  scan_receipt: {
    title: "Scan Receipt",
    description:
      "Attach the receipt image — we'll read the vendor, items and totals and pre-fill one grouped expense line for you.",
    maxWidth: "max-w-[880px]",
  },
};
export const blankReceipt = () => ({
  file: null,
  localPreviewUrl: "",
  imageUrl: "",
  fileName: "",
  description: "",
  qty: "1",
  rate: "",
  items: [],
  vendor: "",
  receiptDate: "",
  currency: "",
  total: 0,
  suggestedCategory: "",
});
export const AVATAR_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "heic", "heif"];
export const AVATAR_ACCEPT = ".png,.jpg,.jpeg,.webp,.heic,.heif";
export const AVATAR_UPLOAD_HINT =
  "Any photo size — PNG, JPG, JPEG, WEBP, HEIC or HEIF.";
export const RECEIPT_ACCEPT = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
export function budgetBreakdown(employee) {
  const issued = Math.max(0, toMoney(employee?.issued_budget));
  const spent = Math.max(0, toMoney(employee?.total_spent));
  const received = Math.max(0, toMoney(employee?.total_received));
  const abono = Math.max(0, toMoney(employee?.total_abono));
  const sent = Math.max(0, toMoney(employee?.total_sent));
  const funded = toMoney(issued + abono + received);
  const remaining = toMoney(received + abono + issued - spent - sent);
  const share =
    funded > 0 ? Number(((remaining / funded) * 100).toFixed(2)) : 0;
  const spentShare =
    funded > 0 ? Number(Math.min(100, Math.max(0, 100 - share)).toFixed(2)) : 0;
  return {
    issued,
    spent,
    remaining,
    received,
    abono,
    sent,
    funded,
    share,
    spentShare,
  };
}

// ── Employee overview ledger (All Transactions) ──────────────────────
// Single-consumer presentation config for the overview feed. Plain
// references (no JSX), so the table, mobile cards, sheet and dialog share
// one source of truth — same pattern as TRANSACTION_KIND_META above.
export const OVERVIEW_TYPE_LABEL_SHORT = {
  issued: "Received",
  expense: "Spent",
  abono: "Abono",
  transfer: "Transfer",
};

// Mobile sheet / desktop dialog header per kind — titled by the item's TYPE
// (Received -> Budget, Spent -> Expenses …) instead of echoing the row's
// description, which already renders in the details body's Description row.
export const OVERVIEW_TYPE_ITEM_TITLE = {
  issued: "Budget",
  expense: "Expenses",
  abono: "Abono",
  transfer: "Transfer",
};

// Instant-scan method tint per payment method so the type is readable
// without parsing text. Unknown methods fall back to neutral.
export const OVERVIEW_METHOD_TONES = {
  cash: "success",
  bank_transfer: "accent",
  e_wallet: "warning",
};

export const OVERVIEW_TYPE_CONFIG = {
  issued: {
    label: "Received",
    badgeTone: "accent",
    Icon: Wallet,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  expense: {
    label: "Paid",
    badgeTone: "neutral",
    Icon: ReceiptText,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  abono: {
    label: "Abono",
    badgeTone: "warning",
    Icon: HandCoins,
    iconWrapperClass: "bg-[var(--warning)]/15 text-[var(--warning)]",
  },
  // Budget transfers are identified by the ArrowLeftRight glyph everywhere in
  // this ledger (table badge, mobile meta, sheet). Direction splits the
  // reading: sent money leaves the pool (−, danger), received money widens it
  // (+, accent) — the same sign convention the budget ledger uses.
  transfer: {
    label: "Transfer",
    badgeTone: "accent",
    Icon: ArrowLeftRight,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
};

// Nine columns: Date, Description, Receipt, Type, Method, Status, Day,
// Amount, Actions.
export const OVERVIEW_COLUMN_WIDTHS = [
  "10%",
  "19%",
  "8%",
  "12%",
  "8%",
  "10%",
  "10%",
  "17%",
  "6%",
];

export const OVERVIEW_PAGE_SIZE = 100;

// ── Employee expenses ledger (All Expenses) ──────────────────────────
// Single-consumer presentation config for the expenses feed. Plain
// references (no JSX), so the table, mobile cards and sheet share one
// source of truth — same pattern as TRANSACTION_KIND_META above.
export const EXPENSES_TYPE_CONFIG = {
  issued: {
    label: "Received",
    badgeTone: "accent",
    Icon: Wallet,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  expense: {
    label: "Paid",
    badgeTone: "neutral",
    Icon: ReceiptText,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  abono: {
    label: "Abono",
    badgeTone: "warning",
    Icon: HandCoins,
    iconWrapperClass: "bg-[var(--warning)]/15 text-[var(--warning)]",
  },
};

// Instant-scan method badge: tint + glyph per payment method so the type is
// readable without parsing text. Unknown methods fall back to neutral.
export const EXPENSES_METHOD_BADGE = {
  cash: { tone: "success", Icon: Banknote },
  bank_transfer: { tone: "accent", Icon: Landmark },
  e_wallet: { tone: "warning", Icon: Wallet },
};

export const EXPENSES_METHOD_FALLBACK = { tone: "neutral", Icon: CreditCard };

// Eight columns: Date, Description, Receipt, Payment Method, Status, Days,
// Amount, Actions.
export const EXPENSES_COLUMN_WIDTHS = [
  "12%",
  "21%",
  "9%",
  "12%",
  "11%",
  "15%",
  "14%",
  "6%",
];

export const EXPENSES_PAGE_SIZE = 100;

// Zoom bounds for the receipt image preview in the expense details modal.
export const EXPENSES_RECEIPT_ZOOM = { min: 0.75, max: 2.2, step: 0.25 };

// Payment-method glyph per method for the expense details modal. Unknown
// methods fall back to a card glyph.
export const EXPENSES_DETAIL_METHOD_ICONS = {
  cash: Banknote,
  bank_transfer: Landmark,
  e_wallet: Wallet,
  cheque: FileText,
};

export const EXPENSES_DETAIL_METHOD_FALLBACK_ICON = CreditCard;
