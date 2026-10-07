import { apiClient } from "./client";

export const budgetsApi = {
  // ── Real API ──
  // Employee budget page — the signed-in employee's own issuances
  // (issued_budget through their budget_issued_reference) + balance overview.
  // The server scopes the rows to the token's user_id; `params` only carries
  // the optional `search` term.
  employee: (params = {}) =>
    apiClient.get("/budgets/employee", { params }).then((r) => r.data),
  list: (params = {}) =>
    apiClient.get("/budgets", { params }).then((r) => r.data),
  budgetTransaction: (params = {}) =>
    apiClient.get("/budgets/transaction", { params }).then((r) => r.data),
  // Issued budget transactions (issued_budget joined to its reference/employee)
  budgetIssuedTransaction: (params = {}) =>
    apiClient
      .get("/budgets/issued_transaction", { params })
      .then((r) => r.data),
  create: (payload) =>
    apiClient
      .post("/budgets", payload)
      .then((r) => r.data.budget ?? r.data.issuedBudget ?? r.data),
  // Source of Funds management (AdminSourceFunds page): EVERY reference
  // with live aggregates (allocated / issued / expenses / remaining /
  // transaction counts), newest first — disconnected sources stay visible
  // here so they can be edited, reopened or deleted.
  sourceFunds: (params = {}) =>
    apiClient.get("/budgets/references", { params }).then((r) => r.data),
  // Edits one source (label / notes / status). Closing ('cut_off')
  // disconnects it from every flow; reopening restores it.
  updateReference: (referenceId, payload) =>
    apiClient
      .patch(`/budgets/references/${referenceId}`, payload)
      .then((r) => r.data.reference ?? r.data),
  // Deferred receipt upload for the Issue Budget scan flow: sends the single
  // held receipt (`file`) in ONE multipart request — called only when the
  // issuance is confirmed, so nothing lands in
  // `uploads/receipts_issued_budget` before that. Responds `{ image_url }`,
  // stored on the `issued_budget` row by the create call that follows.
  uploadIssuedReceiptImage: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post("/budgets/issued-receipt-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.image_url);
  },
  // Deletes a budget reference row (hard delete, cascades to dependent rows)
  removeReference: (referenceId) =>
    apiClient.delete(`/budgets/${referenceId}`).then((r) => r.data),
  // Balance summary for one budget reference (allocated / issued / remaining)
  referenceBalance: (referenceId) =>
    apiClient
      .get(`/budgets/balance/${referenceId}`)
      .then((r) => r.data.balance),
  // Restriction guard for the issuedBudget form — an employee may only hold
  // one OPEN issued budget reference at a time. `referenceId` is the source
  // being issued from and is excluded from the check (top-ups from the same
  // source stay allowed). Returns `{ openReferences, conflict, message }`.
  employeeIssuedGuard: (employeeId, referenceId) =>
    apiClient
      .get(`/budgets/issued_guard/${employeeId}`, {
        params: referenceId ? { reference_id: referenceId } : undefined,
      })
      .then((r) => r.data),
  // Cancels a budget transaction (budget.status -> 'cancelled'). Returns
  // `{ previousStatus, budget }` so the UI can offer an undo window.
  cancelTransaction: (id) =>
    apiClient.patch(`/budgets/${id}/cancel`).then((r) => r.data),
  // Permanently deletes a cancelled budget transaction (hard delete).
  // Admin-only server-side; live rows are refused with 409.
  // Returns `{ budget }`.
  removeTransaction: (id) =>
    apiClient.delete(`/budgets/transaction/${id}`).then((r) => r.data),
  // Undo a cancellation — restores the transaction's previous status.
  restoreTransaction: (id, status) =>
    apiClient.patch(`/budgets/${id}/restore`, { status }).then((r) => r.data),
  // Cancels an issued budget transaction (budget_issued_reference.status ->
  // 'cancel'). Returns `{ previousStatus, issuedReference }`.
  cancelIssuedTransaction: (id) =>
    apiClient
      .patch(`/budgets/issued_transaction/${id}/cancel`)
      .then((r) => r.data),
  // Undo an issued cancellation — restores the reference's previous status.
  restoreIssuedTransaction: (id, status) =>
    apiClient
      .patch(`/budgets/issued_transaction/${id}/restore`, { status })
      .then((r) => r.data),
  // Permanently deletes a cancelled issued budget transaction (hard delete).
  // Admin-only server-side; live rows and rows with linked expenses are
  // refused with 409. Returns `{ issuedTransaction }`.
  removeIssuedTransaction: (id) =>
    apiClient.delete(`/budgets/issued_transaction/${id}`).then((r) => r.data),
};
