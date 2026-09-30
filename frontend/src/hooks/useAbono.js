import { useMutation, useQueryClient } from "@tanstack/react-query";
import { abonoApi } from "../api/abono";

export const abonoKey = (params) => ["abono", params || {}];

// Writes to employee_abono — every mutation refreshes both the admin list
// key (see abonoKey) and the employee page key (useEmployeeAbono), so a row
// added/edited/deleted from the ledger shows up immediately.
export function useAbonoMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["abono"] });
    qc.invalidateQueries({ queryKey: ["employeeAbono"] });
  };

  return {
    // Add Abono modal — { description, amount }.
    create: useMutation({
      mutationFn: abonoApi.create,
      onSuccess: invalidate,
    }),
    // Double-click description edit. The calling sheet/portal also overlays
    // the edit locally (onUpdate) so the ledger text flips without waiting
    // on the refetch.
    updateDescription: useMutation({
      mutationFn: ({ id, description }) =>
        abonoApi.updateDescription(id, description),
      onSuccess: invalidate,
    }),
    // Row action: "Delete abono" removes the record outright.
    remove: useMutation({
      mutationFn: abonoApi.remove,
      onSuccess: invalidate,
    }),
    // Settle Abono — flips the checked OPEN rows to 'settled'. Settled abono
    // stops funding the spendable pool, so every employee view that shows a
    // balance (Overview / Budget / Expenses) refreshes alongside this page.
    settle: useMutation({
      mutationFn: abonoApi.settle,
      onSuccess: () => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["employeeOverview"] });
        qc.invalidateQueries({ queryKey: ["employeeBudget"] });
        qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
      },
    }),
  };
}