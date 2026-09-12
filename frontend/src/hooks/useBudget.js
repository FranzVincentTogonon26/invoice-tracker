import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi } from "../api/budget";

/* ── Budget ──────────────────────────────────────────────────── */
export const budgetsKey = (params) => ["budgets", params || {}];
export function useBudgets(params) {
  const query = useQuery({
    queryKey: budgetsKey(params),
    queryFn: () => budgetsApi.list(params),
  });

  // The API can fail (e.g. 500) or return nothing — resolve `data` to `[]`
  // instead of `undefined` so consumers never crash on missing data.
  return { ...query, data: query.data ?? [] };
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
    // Deletes a budget reference row (hard delete, cascades to dependent rows)
    removeReference: useMutation({
      mutationFn: budgetsApi.removeReference,
      onSuccess: invalidate,
    }),
  };
}
