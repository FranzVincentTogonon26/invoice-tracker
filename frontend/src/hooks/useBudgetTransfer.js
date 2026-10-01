import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetTransferApi } from "../api/budget-transfer";

export const budgetTransferKey = (params) => ["budgetTransfer", params || {}];

// Budget Transfer page data: `{ me, employees, overview }` — the sender's
// spendable balance, their own account card, and the active-employee picker
// (already excluding themselves). Works for both admins and employees; the
// server scopes everything by the token.
export function useBudgetTransfer(params = {}) {
  const query = useQuery({
    queryKey: budgetTransferKey(params),
    queryFn: () => budgetTransferApi.overview(params),
  });

  return {
    ...query,
    me: query.data?.me ?? null,
    employees: query.data?.employees ?? [],
    overview: query.data?.overview ?? {
      totalBalance: 0,
    },
  };
}

// `transfer({ transfer_to, amount, method, notes })` — a successful transfer
// moves money, so every view that shows a balance refreshes alongside the
// form (transfer overview, employee overview / budget / abono, plus the Add
// Expenses source list which is funded from the same remaining balance).
export function useBudgetTransferMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budgetTransfer"] });
    qc.invalidateQueries({ queryKey: ["employeeOverview"] });
    qc.invalidateQueries({ queryKey: ["employeeBudget"] });
    qc.invalidateQueries({ queryKey: ["employeeAbono"] });
    qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  return {
    transfer: useMutation({
      mutationFn: budgetTransferApi.transfer,
      onSuccess: invalidate,
    }),
    // Sheet action: "Cancel budget transfer" removes a sent record outright.
    cancelTransfer: useMutation({
      mutationFn: budgetTransferApi.cancelTransfer,
      onSuccess: invalidate,
    }),
  };
}
