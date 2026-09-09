import { apiClient } from "./client";

export const budgetsApi = {
  // ── Real API ──
  //   list: (params = {}) => apiClient.get("/budgets", { params }).then((r) => r.data),
  create: (payload) =>
    apiClient.post("/budgets", payload).then((r) => r.data.budget),
};
