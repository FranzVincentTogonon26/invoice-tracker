import { apiClient } from "./client";

export const expensesApi = {
  list: (params = {}) =>
    apiClient.get("/expenses", { params }).then((r) => r.data),

  employee: (params = {}) =>
    apiClient.get("/expenses/employee", { params }).then((r) => r.data),

  create: (payload) =>
    apiClient
      .post("/expenses", payload)
      .then(
        (r) =>
          r.data.expenses ?? r.data.category ?? r.data.receipt ?? r.data,
      ),

  // One saved expense for the View expense modal — the row itself plus its
  // scanned receipt lines (and the vendor the lines carry).
  detail: (id) =>
    apiClient.get(`/expenses/detail/${id}`).then((r) => r.data),

  // Removes one expense line.
  remove: (id) => apiClient.delete(`/expenses/${id}`).then((r) => r.data),

  // Removes a category (expense lines using it fall back to uncategorized).
  removeCategory: (id) =>
    apiClient.delete(`/expenses/category/${id}`).then((r) => r.data),
};
