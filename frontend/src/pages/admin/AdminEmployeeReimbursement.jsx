import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, Inbox } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatMoney } from "@/lib/utils";
import { useReimbursementOverview } from "../../hooks/useEmployeeReimbursement";
import { ReimbursementOverview } from "../../components/layout/admin/reimbursement/ReimbursementOverview";
import { ReimbursementPersonnelTable } from "../../components/layout/admin/reimbursement/ReimbursementPersonnelTable";

const AdminEmployeeReimbursement = () => {
  const nav = useNavigate();
  const { data, isLoading, error, refetch } = useReimbursementOverview();

  // "View employee" opens the issuance record under the employees section:
  // `/admin/employees/:id/reimbursement` (where `:id` is the
  // `budget_issued_reference` row id). Same `AdminEmployeesDetails` element
  // as the plain profile — the trailing `reimbursement` segment marks the
  // reimbursement origin (Overview tab first, Back returns here).
  const handleViewEmployee = (row) => {
    const target = row?.id;
    if (target) nav(`/admin/employees/${target}/reimbursement`);
  };
  const handleViewReimbursement = (row) => {
    const target = row?.id;
    if (target) nav(`/admin/reimbursement/${target}`);
  };

  const moneyIn = Number(data?.moneyIn ?? 0);
  const given = Number(data?.given ?? 0);
  const givenSources = Number(data?.givenSources ?? 0);
  const abonoIn = Number(data?.abonoIn ?? 0);
  const abonoCount = Number(data?.abonoCount ?? 0);
  const budget = Number(data?.budget ?? 0);
  const issued = Number(data?.issued ?? 0);
  const openAbono = Number(data?.openAbono ?? 0);
  const spent = Number(data?.spent ?? 0);
  const employeeSpent = Number(data?.employeeSpent ?? 0);
  const forwarded = Number(data?.forwarded ?? 0);
  const openIssuedCount = Number(data?.issuedStatusCounts?.open ?? 0);
  const closeIssuedCount = Number(data?.issuedStatusCounts?.close ?? 0);
  const personnel = data?.personnel ?? [];
  // Per-record issuance rows for the personnel table (one per
  // budget_issued_reference, keyed by its own id). Falls back to the
  // per-user personnel ledger when the backend predates the field.
  const issuanceRecords = data?.records ?? personnel;
  const givenBreakdown = data?.givenBreakdown ?? [];
  const issuedBreakdown = data?.issuedBreakdown ?? [];
  const spentBreakdown = data?.spentBreakdown ?? [];
  const forwardedBreakdown = data?.forwardedBreakdown ?? [];

  // Fund Balance mirrors AdminBudget's My Balance exactly:
  // budget − issued − spent + forwarded. (The reverse order would always read
  // negative and falsely trip the Overdrawn state.)
  const cashOnHand = budget - issued - spent + forwarded;
  // Total Expenses mirrors AdminBudget's headline: admin + employee spend
  // for display. The balance math above intentionally keeps admin-only
  // `spent` (employee spend already left as `issued`).
  const totalSpend = spent + employeeSpent;
  const isBalanceOverdrawn = cashOnHand < -0.004;
  const isBalanceDepleted =
    !isBalanceOverdrawn && Math.abs(cashOnHand) < 0.005 && budget > 0;

  const totals = useMemo(
    () => ({
      moneyIn,
      given,
      givenSources,
      abonoIn,
      abonoCount,
    }),
    [moneyIn, given, givenSources, abonoIn, abonoCount],
  );

  // Per-reference remaining = allocated − issued − spent + forwarded (same
  // formula as the headline balance, just scoped to each budget source —
  // mirrors AdminBudget's cashOnHandBreakdown).
  const issuedByReference = useMemo(
    () =>
      new Map(
        issuedBreakdown.map((row) => [
          row.reference_id,
          Number(row.amount || 0),
        ]),
      ),
    [issuedBreakdown],
  );
  const spentByReference = useMemo(
    () =>
      new Map(
        spentBreakdown.map((row) => [
          row.reference_id,
          Number(row.amount || 0),
        ]),
      ),
    [spentBreakdown],
  );
  const forwardedByReference = useMemo(
    () =>
      new Map(
        forwardedBreakdown.map((row) => [
          row.reference_id,
          Number(row.amount || 0),
        ]),
      ),
    [forwardedBreakdown],
  );
  // Per-reference remaining = allocated − issued − spent + forwarded (same
  // formula as the headline balance, just scoped to each budget source —
  // mirrors AdminBudget's cashOnHandBreakdown).
  const cashOnHandBreakdown = useMemo(() => {
    const rows = givenBreakdown.map((row, i) => {
      const issuedAmt = issuedByReference.get(row.reference_id) ?? 0;
      const spentAmt = spentByReference.get(row.reference_id) ?? 0;
      const forwardedAmt = forwardedByReference.get(row.reference_id) ?? 0;
      const remaining =
        Number(row.amount || 0) - issuedAmt - spentAmt + forwardedAmt;
      return {
        key: row.reference_id ?? i,
        label: row.label ?? "Untitled reference",
        value: formatMoney(remaining),
        tone: remaining < 0 ? "danger" : undefined,
      };
    });
    return rows;
  }, [givenBreakdown, issuedByReference, spentByReference, forwardedByReference]);

  const expensesSummary = useMemo(
    () => [
      { key: "issued", label: "Total Issued", value: formatMoney(issued) },
      {
        key: "spent",
        label: "Total Spent (Admin/Employee)",
        value: formatMoney(totalSpend),
      },
    ],
    [issued, totalSpend],
  );

  const reimbursementRows = useMemo(
    () => [
      { key: "open", label: "Open reimbursement", value: openIssuedCount },
      { key: "close", label: "Close reimbursement", value: closeIssuedCount },
    ],
    [openIssuedCount, closeIssuedCount],
  );

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Reimbursement"
        description="Open employee abono against the fund pool, plus every personnel holding."
      />

      {error ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
            <Inbox size={20} aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-medium text-[var(--ink)]">
              Couldn&apos;t load reimbursement
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {error?.message ||
                "Something went wrong while loading the overview."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : (
        <>
          {abonoCount > 0 && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3"
            >
              <CircleAlert
                size={17}
                className="mt-px shrink-0 text-[var(--warning)]"
                aria-hidden
              />
              <p className="text-sm leading-snug text-[var(--ink)]">
                <span className="font-medium tabular-nums">
                  {formatMoney(openAbono)}
                </span>{" "}
                open abono held by {abonoCount}{" "}
                {abonoCount === 1 ? "employee needs" : "employees need"}{" "}
                settlement — open the employee&apos;s Reimbursement page to
                settle it.
              </p>
            </div>
          )}
          <ReimbursementOverview
            isLoading={isLoading}
            totals={totals}
            givenBreakdown={givenBreakdown}
            cashOnHand={cashOnHand}
            isBalanceOverdrawn={isBalanceOverdrawn}
            isBalanceDepleted={isBalanceDepleted}
            cashOnHandBreakdown={cashOnHandBreakdown}
            totalSpend={totalSpend}
            expensesSummary={expensesSummary}
            openTotal={openAbono}
            reimbursementRows={reimbursementRows}
          />
          <ReimbursementPersonnelTable
            rows={issuanceRecords}
            isLoading={isLoading}
            onViewEmployee={handleViewEmployee}
            onViewReimbursement={handleViewReimbursement}
          />
        </>
      )}
    </div>
  );
};

export default AdminEmployeeReimbursement;
