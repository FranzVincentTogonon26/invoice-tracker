import { apiClient } from "./client";

export const employeeReimbursementApi = {
  list: (params = {}) =>
    apiClient.get("/employee-reimbursements", { params }).then((r) => r.data),
  overview: () =>
    apiClient.get("/employee-reimbursements/overview").then((r) => r.data),
};
