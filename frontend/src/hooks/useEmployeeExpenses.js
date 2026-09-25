import { useQuery } from "@tanstack/react-query";
import { expensesApi } from "../api/expenses";

export const employeeExpensesKey = (params) => ["employeeExpenses", params || {}];

export function useEmployeeExpenses(params = {}) {
  const query = useQuery({
    queryKey: employeeExpensesKey(params),
    queryFn: () => expensesApi.employee(params),
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
