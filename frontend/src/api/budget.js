import { apiClient } from "./client";

export const budgetsApi = {
  // ── Real API ──
  list: (params = {}) =>
    apiClient.get("/budgets", { params }).then((r) => r.data),
  budgetTransaction: (params = {}) =>
    apiClient.get("/budgets/transaction", { params }).then((r) => r.data),
  create: (payload) =>
    apiClient
      .post("/budgets", payload)
      .then((r) => r.data.budget ?? r.data.issuedEmployee),
  // Deletes a budget reference row (hard delete, cascades to dependent rows)
  removeReference: (referenceId) =>
    apiClient.delete(`/budgets/${referenceId}`).then((r) => r.data),
  // Balance summary for one budget reference (allocated / issued / remaining)
  referenceBalance: (referenceId) =>
    apiClient
      .get(`/budgets/balance/${referenceId}`)
      .then((r) => r.data.balance),
  // Cancels a budget transaction (budget.status -> 'cancelled'). Returns
  // `{ previousStatus, budget }` so the UI can offer an undo window.
  cancelTransaction: (id) =>
    apiClient.patch(`/budgets/${id}/cancel`).then((r) => r.data),
  // Undo a cancellation — restores the transaction's previous status.
  restoreTransaction: (id, status) =>
    apiClient.patch(`/budgets/${id}/restore`, { status }).then((r) => r.data),
};
