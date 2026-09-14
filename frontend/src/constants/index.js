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
  pending: { tone: "danger", label: "Pending" },
  added: { tone: "accent", label: "Added" },
  cancelled: { tone: "danger", label: "Cancelled" },
};
