import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "../api/employees";

// ── Admin → Employees → Details (`/admin/employees/:id`, `:id/overview`,
// `:id/reimbursement`) ──
//
// `view` comes from the page URL's trailing section and drives server-side
// scoping: `'reimbursement'` keys every ledger on ONE
// `budget_issued_reference.id` via `issued_ref_id`; `'overview'` (the
// default) keys on the user's OPEN holdings only
// (`budget_issued_reference.status = 'open'`). The server re-validates the
// id on every request (any account status), so a bad or stale link can never
// read someone else's rows silently.
//
// Every hook mirrors the payload shape its employee-facing twin returns, so
// the shared transaction sections render identical rows in both views.
// `issuedRef` (null on user-scoped links) rides along for record labeling.

export const employeeDetailsKey = (id, section) => [
  "employeeDetails",
  String(id ?? ""),
  section,
];

const enabledFor = (id) => Boolean(id);

/* ── bir-id deep links (`/admin/employees/:id` with a ────────────────────
 * `budget_issued_reference` row id, e.g. from issuance tables): resolves the
 * record to its holder's user id. Call with `null` to keep it idle — the
 * profile page only fires this when the roster has loaded and still holds
 * no match, so plain user-id links never pay for an extra request. A miss
 * is final (retry: false), not a signal problem. */
export function useIssuanceHolder(birId, options = {}) {
  const query = useQuery({
    queryKey: ["employeeDetails", "holder", String(birId ?? "")],
    queryFn: () => employeesApi.holderByIssuance(birId),
    enabled: enabledFor(birId),
    retry: false,
    ...options,
  });

  return {
    ...query,
    holder: query.data?.holder ?? null,
    issuedRef: query.data?.issuedRef ?? null,
  };
}

/* ── Overview tab: stats + every merged transaction ─────────────────────── */
export function useEmployeeDetailsOverview(id, view) {
  const query = useQuery({
    queryKey: [...employeeDetailsKey(id, "overview"), view ?? null],
    queryFn: () =>
      employeesApi.detailsOverview(id, view ? { view } : undefined),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    data: query.data?.employeeOverview ?? null,
    issuedRef: query.data?.issuedRef ?? null,
  };
}

/* ── Budget tab: issuances + transfers with the balance overview ─────────── */
export function useEmployeeDetailsBudget(id, view) {
  const query = useQuery({
    queryKey: [...employeeDetailsKey(id, "budget"), view ?? null],
    queryFn: () => employeesApi.detailsBudget(id, view ? { view } : undefined),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    transactions: query.data?.transactions ?? [],
    issuedRef: query.data?.issuedRef ?? null,
    overview: query.data?.overview ?? {
      totalBudget: 0,
      totalExpenses: 0,
      totalAbono: 0,
      totalBalance: 0,
      activeReferences: 0,
    },
  };
}

/* ── Expenses tab: the full expense ledger ───────────────────────────────── */
export function useEmployeeDetailsExpenses(id, view) {
  const query = useQuery({
    queryKey: [...employeeDetailsKey(id, "expenses"), view ?? null],
    queryFn: () =>
      employeesApi.detailsExpenses(id, view ? { view } : undefined),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    expenses: query.data?.expenses ?? [],
    categories: query.data?.categories ?? [],
    references: query.data?.references ?? [],
    issuedRef: query.data?.issuedRef ?? null,
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

/* ── Abono tab: abono rows + the balance the spent-guard needs ───────────── */
export function useEmployeeDetailsAbono(id, view) {
  const query = useQuery({
    queryKey: [...employeeDetailsKey(id, "abono"), view ?? null],
    queryFn: () => employeesApi.detailsAbono(id, view ? { view } : undefined),
    enabled: enabledFor(id),
  });

  return {
    ...query,
    abono: query.data?.abono ?? [],
    issuedRef: query.data?.issuedRef ?? null,
    overview: query.data?.overview ?? {
      totalAbono: 0,
      totalBudget: 0,
      totalExpenses: 0,
      totalBalance: 0,
      abonoCount: 0,
    },
  };
}
