import { useQuery } from "@tanstack/react-query";
import { budgetsApi } from "../api/budget";

export const employeeBudgetKey = (params) => ["employeeBudget", params || {}];

// Employee budget page data: every `issued_budget` row the employee received
// (through their own `budget_issued_reference`, scoped server-side to the
// token's user_id) plus the balance overview. Read-only — issuing and
// cancelling budgets stay admin actions, so there are no mutations here.
export function useEmployeeBudget(params = {}) {
  const query = useQuery({
    queryKey: employeeBudgetKey(params),
    queryFn: () => budgetsApi.employee(params),
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
