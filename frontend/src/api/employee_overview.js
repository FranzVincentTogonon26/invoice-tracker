import { apiClient } from "./client";

export const employeeOverviewsApi = {
  list: (params = {}) =>
    apiClient.get("/employee_overview", { params }).then((r) => r.data),
};
