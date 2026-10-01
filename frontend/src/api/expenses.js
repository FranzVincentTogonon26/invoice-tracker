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

  // Deferred receipt upload: sends every receipt the Add Expenses form still
  // holds in ONE multipart request — called only when the admin confirms
  // "Save expenses", so nothing lands in `uploads/receipts` before that.
  // Responds `{ images: [{ file_name, image_url }] }` in the same order the
  // files were appended, so each URL can be zipped back onto its line.
  uploadReceiptImages: (files) => {
    const form = new FormData();
    (files ?? []).forEach((file) => form.append("files", file));
    return apiClient
      .post("/expenses/receipt-images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.images ?? []);
  },

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
  // expense that is still 'paid' (or voided 'cancel') back to 'draft'.
  // Admin-only on the server — the guarded UPDATE only matches rows whose
  // author is an employee and whose status is still 'paid' or 'cancel'.
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

  // Admin approval for a flagged expense: clears `expenses.flag` back to 0.
  // Called by the "Approve flag" action inside the flaggedNotice of the View
  // expense modal. Admin-only on the server.
  clearFlag: (id) =>
    apiClient.patch(`/expenses/${id}/clear-flag`).then((r) => r.data),

  // Removes a category (expense lines using it fall back to uncategorized).
  removeCategory: (id) =>
    apiClient.delete(`/expenses/category/${id}`).then((r) => r.data),
};
