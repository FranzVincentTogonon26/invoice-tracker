import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "../api/employees";

// ── Admin → Employees → Details (`/admin/employees/:id`) ──
//
// One SELECTED employee's records, read-only. Unlike the employee-facing
// hooks (`useEmployeeOverview`, `useEmployeeBudget`, …) the user id is passed
// in by the caller — it is the route param — and the server re-validates it
// against the `users` table on every request (any account status), so a bad
// or stale link can never read someone else's rows silently.
//
// Every hook mirrors the payload shape its employee-facing twin returns, so
// the shared transaction sections render identical rows in both views.

export const employeeDetailsKey = (id, section) => [
  "employeeDetails",
  String(id ?? ""),
  section,
];

const enabledFor = (id) => Boolean(id);

/* ── Overview tab: stats + every merged transaction ─────────────────────── */
export function useEmployeeDetailsOverview(id) {
  const query = useQuery({
    queryKey: employeeDetailsKey(id, "overview"),
    queryFn: () => employeesApi.detailsOverview(id),
    enabled: enabledFor(id),
  });

  return { ...query, data: query.data?.employeeOverview ?? null };
}

/* ── Budget tab: issuances + transfers with the balance overview ─────────── */
export function useEmployeeDetailsBudget(id) {
  const query = useQuery({
    queryKey: employeeDetailsKey(id, "budget"),
    queryFn: () => employeesApi.detailsBudget(id),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    transactions: query.data?.transactions ?? [],
    overview: query.data?.overview ?? {
      totalBudget: 0,
      totalExpenses: 0,
      totalAbono: 0,
      totalBalance: 0,
      activeReferences: 0,
    },
  };
}

/* ── Expenses tab: the full expense ledger ───────────────────────────────── */
export function useEmployeeDetailsExpenses(id) {
  const query = useQuery({
    queryKey: employeeDetailsKey(id, "expenses"),
    queryFn: () => employeesApi.detailsExpenses(id),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    expenses: query.data?.expenses ?? [],
    categories: query.data?.categories ?? [],
    references: query.data?.references ?? [],
    overview: query.data?.overview ?? {
      totalBudget: 0,
      totalExpenses: 0,
      totalAbono: 0,
      totalBalance: 0,
      thisMonth: 0,
      totalTransactions: 0,
      totalCategories: 0,
    },
  };
}

/* ── Abono tab: abono rows + the balance the spent-guard needs ───────────── */
export function useEmployeeDetailsAbono(id) {
  const query = useQuery({
    queryKey: employeeDetailsKey(id, "abono"),
    queryFn: () => employeesApi.detailsAbono(id),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    abono: query.data?.abono ?? [],
    overview: query.data?.overview ?? {
      totalAbono: 0,
      totalBudget: 0,
      totalExpenses: 0,
      totalBalance: 0,
      abonoCount: 0,
    },
  };
}
