import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi } from "../api/budget";

export const sourceFundsKey = (params) => ["budgets", "sources", params || {}];

// Source of Funds management (AdminSourceFunds page): every budget reference
// with live aggregates, newest first. Nests under ["budgets", …] so the
// shared budget invalidation plus the realtime bridge refresh it live.
export function useSourceFunds(params) {
  const query = useQuery({
    queryKey: sourceFundsKey(params),
    queryFn: () => budgetsApi.sourceFunds(params),
  });

  return {
    ...query,
    sources: query.data?.sources ?? [],
  };
}

export function useSourceFundsMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };
  return {
    // Creates one source (label + optional notes). New sources always open
    // as 'open'.
    createReference: useMutation({
      mutationFn: ({ label, notes }) =>
        budgetsApi.create({
          type: "addBudgetReference",
          label,
          reference_notes: notes || undefined,
        }),
      onSuccess: invalidate,
    }),
    // Edits one source (label / notes / status).
    updateReference: useMutation({
      mutationFn: ({ referenceId, payload }) =>
        budgetsApi.updateReference(referenceId, payload),
      onSuccess: invalidate,
    }),
    // Deletes a source row (hard delete, cascades to dependent rows).
    removeReference: useMutation({
      mutationFn: budgetsApi.removeReference,
      onSuccess: invalidate,
    }),
  };
}
