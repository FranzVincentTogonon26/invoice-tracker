import { apiClient } from "./client";

export const budgetTransferApi = {
  // Transfer form data in one round-trip: the sender's spendable balance,
  // their own account card, and the active-employee picker. Works for both
  // admins and active employees (scoped server-side by the token).
  overview: (params = {}) =>
    apiClient.get("/budget-transfer/overview", { params }).then((r) => r.data),

  // Moves funds to another active employee. The source of funds is resolved
  // server-side and the remaining balance is re-checked there.
  transfer: (payload) =>
    apiClient.post("/budget-transfer", payload).then((r) => r.data),
};
