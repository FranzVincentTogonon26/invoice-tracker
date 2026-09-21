import { apiClient } from "./client";

export const expensesApi = {
  list: (params = {}) =>
    apiClient.get("/expenses", { params }).then((r) => r.data),

  create: (payload) =>
    apiClient
      .post("/expenses", payload)
      .then(
        (r) =>
          r.data.expenses ?? r.data.category ?? r.data.receipt ?? r.data,
      ),

  // Removes one expense line.
  remove: (id) => apiClient.delete(`/expenses/${id}`).then((r) => r.data),

  // Removes a category (expense lines using it fall back to uncategorized).
  removeCategory: (id) =>
    apiClient.delete(`/expenses/category/${id}`).then((r) => r.data),
};
