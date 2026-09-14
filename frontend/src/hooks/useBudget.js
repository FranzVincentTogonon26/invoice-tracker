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

export function useBudgetTransaction(params) {
  const query = useQuery({
    queryKey: budgetsKey(params),
    queryFn: () => budgetsApi.budgetTransaction(params),
  });

  // The API returns `{ budgetTransaction: [...] }` — unwrap to the plain array
  // so consumers can map over `data` directly. Resolves to `[]` while loading
  // or on failure instead of `undefined`.
  return { ...query, data: query.data?.budgetTransaction ?? [] };
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
    // Cancels a budget transaction (budget.status -> 'cancelled')
    cancelTransaction: useMutation({
      mutationFn: budgetsApi.cancelTransaction,
      onSuccess: invalidate,
    }),
    // Undo a cancellation — restores the transaction's previous status
    restoreTransaction: useMutation({
      mutationFn: ({ id, status }) => budgetsApi.restoreTransaction(id, status),
      onSuccess: invalidate,
    }),
  };
}

// Live balance summary for a single budget reference (issuedBudget form).
// Only fetched when `enabled` and a reference is actually selected — the
// key nests under ["budgets", …] so the shared `invalidate()` above also
// refetches this after every create/remove.
export function useBudgetBalance(referenceId, enabled = true) {
  const query = useQuery({
    queryKey: ["budgets", "balance", referenceId || null],
    queryFn: () => budgetsApi.referenceBalance(referenceId),
    enabled: Boolean(enabled && referenceId),
  });

  return {
    ...query,
    // Empty references legitimately return zeros — never resolve to undefined
    data: query.data ?? { allocated: 0, issued: 0, balance: 0 },
  };
}
