import { useQuery } from "@tanstack/react-query";
import { abonoApi } from "../api/abono";

export const employeeAbonoKey = (params) => ["employeeAbono", params || {}];

// The Abono page query: employee_abono rows for the signed-in user (scoped
// server-side by the token's user_id) plus the overview the hero and mini
// stats render.
export function useEmployeeAbono(params = {}) {
  const query = useQuery({
    queryKey: employeeAbonoKey(params),
    queryFn: () => abonoApi.employee(params),
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
