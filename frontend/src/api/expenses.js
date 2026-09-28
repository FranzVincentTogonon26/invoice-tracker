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

  // Soft delete for the employee ledger: keeps the row and only flips its
  // status — the row action's "Delete expense" parks it in 'draft'.
  updateStatus: (id, status) =>
    apiClient.patch(`/expenses/${id}/status`, { status }).then((r) => r.data),

  // Admin ledger row action ("Add to draft"): pushes an employee-authored
  // expense that is still 'paid' back to 'draft'. Admin-only on the server —
  // the guarded UPDATE only matches rows whose author is an employee and
  // whose status is still 'paid'.
  markEmployeeDraft: (id) =>
    apiClient
      .patch(`/expenses/${id}/employee-draft`)
      .then((r) => r.data),

  // Admin ledger row action ("Remove from draft"): the counterpart — an
  // employee-authored draft is put back to 'paid' and counts against that
  // employee's balance again. Admin-only on the server; the guarded UPDATE
  // only matches employee-authored rows still sitting in 'draft'.
  markEmployeePaid: (id) =>
    apiClient
      .patch(`/expenses/${id}/employee-paid`)
      .then((r) => r.data),

  // Update expense description (inline editing)
  updateDescription: (id, description) =>
    apiClient.patch(`/expenses/${id}/description`, { description }).then((r) => r.data),

  // Removes a category (expense lines using it fall back to uncategorized).
  removeCategory: (id) =>
    apiClient.delete(`/expenses/category/${id}`).then((r) => r.data),
};
