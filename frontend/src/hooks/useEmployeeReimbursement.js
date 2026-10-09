import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeReimbursementApi } from "../api/employee-reimbursement";

export const reimbursementsKey = ["reimbursements"];
export const reimbursementOverviewKey = ["reimbursements", "overview"];

// Admin → Reimbursement overview: fund-pool totals, open abono by employee,
// chart timeline and the per-personnel ledger in one round trip.
export function useReimbursementOverview() {
  const query = useQuery({
    queryKey: reimbursementOverviewKey,
    queryFn: () => employeeReimbursementApi.overview(),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Admin settlement: settle an employee's checked OPEN abono rows and book
// each amount back as issued budget. Refreshes every surface the settlement
// moves money on: the fund-pool overview, budget pages, the employee's
// details views and the ledgers.
export function useSettleAbono() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => employeeReimbursementApi.settle(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reimbursementOverviewKey });
      qc.invalidateQueries({ queryKey: reimbursementsKey });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["employeeDetails"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

// Admin submit: finalize an employee's reimbursement (closes every OPEN
// issuance reference they hold). Refreshes the same surfaces settlement
// moves money on.
export function useSubmitReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => employeeReimbursementApi.submit(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reimbursementOverviewKey });
      qc.invalidateQueries({ queryKey: reimbursementsKey });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["employeeDetails"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

// Back-compat list hook for GET /employee-reimbursements (admin abono rows).
export function useEmployeeReimbursement(params = {}) {
  const query = useQuery({
    queryKey: [...reimbursementsKey, params || {}],
    queryFn: () => employeeReimbursementApi.list(params),
  });

  return {
    data: query.data,
    rows: query.data?.reimbursements ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
