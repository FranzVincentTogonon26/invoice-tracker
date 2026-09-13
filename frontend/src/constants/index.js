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
  { key: "draft", label: "Draft" },
  { key: "cancelled", label: "Cancelled" },
];
