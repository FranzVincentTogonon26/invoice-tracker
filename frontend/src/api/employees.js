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
  // Admin replaces one employee's profile photo (multipart `avatar` file).
  updateAvatar: (id, file) => {
    const form = new FormData();
    form.append("avatar", file);
    return apiClient
      .patch(`/employees/${id}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  /* ── Admin → Employee Details tabs (`/admin/employees/:id`) ──
   * One SELECTED employee's records, read-only (whole profile on a user id,
   * single issuance on a `budget_issued_reference` row id). Each endpoint
   * re-validates the id server-side (any account status) and returns the same
   * payload shape the employee-facing endpoint returns, so the shared
   * transaction sections render identically — plus `issuedRef` (null on
   * plain user-id links). Bir-id links scope every ledger through
   * `issued_ref_id = budget_issued_reference.id`. */
  detailsOverview: (id, params = {}) =>
    apiClient.get(`/employees/${id}/overview`, { params }).then((r) => r.data),
  detailsBudget: (id, params = {}) =>
    apiClient.get(`/employees/${id}/budget`, { params }).then((r) => r.data),
  detailsExpenses: (id, params = {}) =>
    apiClient.get(`/employees/${id}/expenses`, { params }).then((r) => r.data),
  detailsAbono: (id, params = {}) =>
    apiClient.get(`/employees/${id}/abono`, { params }).then((r) => r.data),
  // Holder of one issuance record (`{ holder: { user_id, ... } }`) — lets
  // bir-id deep links into `/admin/employees/:id` render the holder's roster
  // header while the tabs keep querying by the issuance record id.
  holderByIssuance: (birId) =>
    apiClient.get(`/employees/by-issuance/${birId}`).then((r) => r.data),
};
