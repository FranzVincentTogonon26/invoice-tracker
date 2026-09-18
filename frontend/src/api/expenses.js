import { apiClient } from "./client";

export const expensesApi = {
  // GET /expenses → { expenses: [...], categories: [...], overview: {...} }
  // `params` accepts { from, to } (YYYY-MM-DD) to window the ledger.
  list: (params = {}) =>
    apiClient.get("/expenses", { params }).then((r) => r.data),

  // Single create endpoint discriminated by `type`, mirroring POST /budgets:
  //   { type: "expense",  items: [...] }   → saves one or many expense lines
  //   { type: "category", category_name }  → adds a category
  //   { type: "receipt",  description, qty, rate, amount, image_url }
  //                                        → saves a scanned receipt
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
