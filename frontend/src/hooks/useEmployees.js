import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "../api/employees";

/* ── Employees ──────────────────────────────────────────────────── */
export const employeesKey = (params) => ["employees", params || {}];

export function useEmployees(params) {
  const query = useQuery({
    queryKey: employeesKey(params),
    queryFn: () => employeesApi.list(params),
  });

  // The API returns `{ employees: [...] }` — unwrap to the plain array so
  // consumers can map over `data` directly. Resolves to `[]` while loading
  // or on failure instead of `undefined`.
  return { ...query, data: query.data?.employees ?? [] };
}

export function useEmployeesOverview() {
  const query = useQuery({
    queryKey: ["employees", "overview"],
    queryFn: () => employeesApi.overview(),
  });

  // The API returns `{ overview: {...} }` — unwrap it and keep every stat
  // key numeric so the stat cards never render undefined.
  return {
    ...query,
    data: query.data?.overview ?? {
      totalEmployees: 0,
      activeEmployees: 0,
      pendingApproval: 0,
      inactiveEmployees: 0,
      totalEmployeeIssued: 0,
    },
  };
}

export function useEmployeesMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
  };
  return {
    // Adds a new employee account; `create({ name, email, password })`.
    create: useMutation({
      mutationFn: employeesApi.create,
      onSuccess: invalidate,
    }),
    // Approves / activates / deactivates an account; `updateStatus({ id, status })`.
    updateStatus: useMutation({
      mutationFn: ({ id, status }) => employeesApi.updateStatus(id, status),
      onSuccess: invalidate,
    }),
    // Hard-removes an employee account; `remove(id)`.
    remove: useMutation({
      mutationFn: employeesApi.remove,
      onSuccess: invalidate,
    }),
  };
}
