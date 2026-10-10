import { apiClient } from "./client";

export const employeeReimbursementApi = {
  list: (params = {}) =>
    apiClient.get("/employee-reimbursements", { params }).then((r) => r.data),
  overview: () =>
    apiClient.get("/employee-reimbursements/overview").then((r) => r.data),
  // Admin settlement: flip an employee's checked OPEN abono rows to settled
  // and book each amount back as issued budget under the same reference.
  settle: (payload) =>
    apiClient.post("/employee-reimbursements/settle", payload).then((r) => r.data),
  // Admin submit: finalize an employee's reimbursement by closing every
  // OPEN issuance reference they hold. Optional `payload.note` is stamped
  // onto each closed record; each record's leftover is stored as
  // `balance_forwarded`.
  submit: (userId, payload) =>
    apiClient
      .post(`/employee-reimbursements/${userId}/submit`, payload ?? {})
      .then((r) => r.data),
};
