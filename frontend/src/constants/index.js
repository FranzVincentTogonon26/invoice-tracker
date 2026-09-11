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
