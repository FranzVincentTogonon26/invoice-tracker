export const USER_ROLES = {
  ADMIN: "admin",
  EMPLOYEE: "employee",
};

// Payment methods accepted by `POST /budgets` (`budget.method`)
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
  // "pending" is an actionable, queued state — it reads amber (warning) the same
  // way the Employees list does. Red (danger) is reserved for failures/overdue.
  pending: { tone: "warning", label: "Pending" },
  added: { tone: "accent", label: "Added" },
  cancelled: { tone: "danger", label: "Cancelled" },
  // budget_issued_reference.status values (Budget Issued Transaction tab).
  // `open` reads amber (warning) — an open issuance is live money still waiting
  // to be closed out, an actionable state — not the decorative accent teal.
  // `close` stays amber as its resolved twin and `cancel` keeps danger, so a
  // cancelled line is never amber while an expense Cancelled is red.
  open: { tone: "warning", label: "Open" },
  cancel: { tone: "danger", label: "Cancelled" },
  close: { tone: "warning", label: "Closed" },
  // users.status values (Employees tab)
  active: { tone: "success", label: "Active" },
  inactive: { tone: "neutral", label: "Inactive" },
};

// Shared constants + factory for the ExpensesModal family. Kept in one place
// so the panels, the modal and the scan engine all quote the same values.

export const ERROR_VISIBLE_MS = 5000;

// Max receipt upload size — kept in sync with the backend multer limit
// (middleware/upload.js, 10MB). The scan stores the file server-side and the
// draft only carries its URL, so this cap is about what the AI can read, not
// about what fits in localStorage.
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

// Exactly the set the scan engine validates against (PNG/JPG/WEBP + PDF) —
// a broad "image/*" would let GIF/BMP/SVG through the picker only to fail
// the scan.
export const RECEIPT_ACCEPT = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};
