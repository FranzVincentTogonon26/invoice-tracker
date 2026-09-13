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
};
