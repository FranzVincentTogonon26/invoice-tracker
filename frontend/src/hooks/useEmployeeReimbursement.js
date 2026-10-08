import { useQuery } from "@tanstack/react-query";
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
