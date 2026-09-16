import { apiClient } from "./client";

export const employeesApi = {
  // Full employee list (admin management view; supports status + search via
  // query params). Unwraps `{ employees: [...] }` in the hook.
  list: (params = {}) =>
    apiClient.get("/employees", { params }).then((r) => r.data),
  // Dashboard stats for the Employees page stat cards.
  overview: () => apiClient.get("/employees/overview").then((r) => r.data),
  // Provisions a new employee account (role 'employee', status 'active').
  create: (payload) =>
    apiClient.post("/employees", payload).then((r) => r.data),
  // Approve / activate / deactivate an account: status is 'active' or
  // 'inactive'. Pending self-registered employees are approved via 'active'.
  updateStatus: (id, status) =>
    apiClient.patch(`/employees/${id}/status`, { status }).then((r) => r.data),
  // Removes an employee account (cascades their issued budget references).
  remove: (id) => apiClient.delete(`/employees/${id}`).then((r) => r.data),
};
