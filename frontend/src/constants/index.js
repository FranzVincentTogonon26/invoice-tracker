export const USER_ROLES = { ADMIN: "admin", EMPLOYEE: "employee" };
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
  close: { tone: "warning", label: "Closed" },
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
