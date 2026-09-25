import { useQuery } from "@tanstack/react-query";
import { employeeOverviewsApi } from "../api/employee_overview";

/* ── Employee overview (scoped to the logged-in user server-side) ── */
// The API responds `{ employeeOverview: { totalBudget, totalExpenses,
// totalAbono, totalBalance, activeReferences, expenseCount, abonoCount } }` —
// unwrap it here so consumers receive the stats object directly.
export const overviewsKey = (params) => ["employeeOverview", params || {}];
export function useEmployeeOverview(params) {
  const query = useQuery({
    queryKey: overviewsKey(params),
    queryFn: () => employeeOverviewsApi.list(params),
  });

  return { ...query, data: query.data?.employeeOverview ?? null };
}
