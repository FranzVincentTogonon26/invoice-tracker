import { apiClient } from "./client";

export const abonoApi = {
  // Admin ledger: every abono row across employees (employees calling this
  // receive only their own rows — the controller scopes by the token).
  list: (params = {}) => apiClient.get("/abono", { params }).then((r) => r.data),

  // Employee Abono page: rows from employee_abono for the signed-in user
  // plus the hero/mini-stat overview.
  employee: (params = {}) =>
    apiClient.get("/abono/employee", { params }).then((r) => r.data),

  // Add Abono modal — { description, amount }. The source of funds is
  // resolved server-side against the employee's open issuances.
  create: (payload) =>
    apiClient.post("/abono", payload).then((r) => r.data.abono ?? r.data),

  // Double-click description edit (transaction sheet / details portal).
  updateDescription: (id, description) =>
    apiClient
      .patch(`/abono/${id}/description`, { description })
      .then((r) => r.data),

  // Settle Abono — flips the checked OPEN rows to 'settled' server-side and
  // stamps `date_settled`. The server re-validates the remaining balance and
  // answers with the insufficient-balance 400 when the selection can't be
  // covered.
  settle: (ids) =>
    apiClient.patch("/abono/settle", { ids }).then((r) => r.data),

  // Admin Reimburse — repays an employee who spent their own money by
  // settling the checked OPEN abono rows on their behalf. Admin-only
  // server-side; the target account is validated there.
  reimburse: (userId, ids) =>
    apiClient
      .patch("/abono/reimburse", { user_id: userId, ids })
      .then((r) => r.data),

  // Row action: permanently removes the abono record.
  remove: (id) => apiClient.delete(`/abono/${id}`).then((r) => r.data),
};
