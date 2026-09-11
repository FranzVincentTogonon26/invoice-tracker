import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi } from "../api/budget";

/* ── Budget ──────────────────────────────────────────────────── */
export const budgetsKey = (params) => ["budgets", params || {}];
export function useBudgets(params) {
  return useQuery({ queryKey: budgetsKey(params), queryFn: () => budgetsApi.list(params) });
}
export function useBudgetMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };
  return {
    create: useMutation({
      mutationFn: budgetsApi.create,
      onSuccess: invalidate,
    }),
    // remove: useMutation({ mutationFn: budgetsApi.remove, onSuccess: invalidate }),
  };
}
