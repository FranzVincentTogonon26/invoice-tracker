import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatDate, formatMoney } from "@/lib/utils";
import { useReimbursementOverview } from "../../hooks/useEmployeeReimbursement";
import { ReimbursementOverview } from "../../components/layout/admin/reimbursement/ReimbursementOverview";
import { ReimbursementPersonnelTable } from "../../components/layout/admin/reimbursement/ReimbursementPersonnelTable";

const AdminEmployeeReimbursement = () => {
  const nav = useNavigate();
  const { data, isLoading, error, refetch } = useReimbursementOverview();

  const handleViewEmployee = (row) => {
    if (row?.userId) nav(`/admin/employees/${row.userId}`);
  };
  const handleViewReimbursement = (row) => {
    if (row?.userId) nav(`/admin/employees/${row.userId}?tab=employee_abono`);
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
  const openIssuedCount = Number(data?.issuedStatusCounts?.open ?? 0);
  const closeIssuedCount = Number(data?.issuedStatusCounts?.close ?? 0);
  const personnel = data?.personnel ?? [];
  const givenBreakdown = data?.givenBreakdown ?? [];
  const issuedBreakdown = data?.issuedBreakdown ?? [];
  const spentBreakdown = data?.spentBreakdown ?? [];

  // Fund Balance mirrors ExpenseOverview's My Balance:
  // MoneyIn − (Issued + Spent). (The reverse order would always read
  // negative and falsely trip the Overdrawn state.)
  const cashOnHand = budget - (issued + spent);
  // Expenses Summary hero mirrors ExpenseOverview's Total Expenses headline:
  // Issued + admin Spent. (The "Total Spent (Admin/Employee)" bullet row below
  // additionally folds in all-personnel spend, so the rows no longer sum to
  // the hero — that row is informational by design.)
  const personnelSpentTotal = useMemo(
    () => personnel.reduce((sum, row) => sum + (Number(row.spent) || 0), 0),
    [personnel],
  );
  const combinedSpentTotal = personnelSpentTotal + spent;
  const totalSpend = issued + spent;
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

  // Per-reference remaining = allocated − issued − spent (same formula as
  // the headline balance, just scoped to each budget source — mirrors
  // AdminBudget's cashOnHandBreakdown).
  const issuedByReference = useMemo(
    () =>
      new Map(
        issuedBreakdown.map((row) => [row.reference_id, Number(row.amount || 0)]),
      ),
    [issuedBreakdown],
  );
  const spentByReference = useMemo(
    () =>
      new Map(
        spentBreakdown.map((row) => [
          row.reference_id ?? "__untagged",
          Number(row.amount || 0),
        ]),
      ),
    [spentBreakdown],
  );
  const cashOnHandBreakdown = useMemo(() => {
    const rows = givenBreakdown.map((row, i) => {
      const issuedAmt = issuedByReference.get(row.reference_id) ?? 0;
      const spentAmt = spentByReference.get(row.reference_id) ?? 0;
      const remaining = Number(row.amount || 0) - issuedAmt - spentAmt;
      return {
        key: row.reference_id ?? i,
        label: row.label ?? "Untitled reference",
        value: formatMoney(remaining),
        hint: formatDate(row.created_at),
        tone: remaining < 0 ? "danger" : undefined,
      };
    });
    // Untagged admin spend belongs to no source — show it as its own row so
    // the breakdown still sums to the headline balance.
    const untagged = spentByReference.get("__untagged") ?? 0;
    if (untagged > 0) {
      rows.push({
        key: "untagged",
        label: "No source of funds",
        value: formatMoney(-untagged),
        hint: "Untagged",
        tone: "danger",
      });
    }
    return rows;
  }, [givenBreakdown, issuedByReference, spentByReference]);

  const expensesSummary = useMemo(
    () => [
      { key: "issued", label: "Total Issued", value: formatMoney(issued) },
      {
        key: "spent",
        label: "Total Spent (Admin/Employee)",
        value: formatMoney(combinedSpentTotal),
      },
    ],
    [issued, combinedSpentTotal],
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
              {error?.message || "Something went wrong while loading the overview."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : (
        <>
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
            rows={personnel}
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
