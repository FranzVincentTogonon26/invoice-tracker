import { useMemo } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatMoney } from "@/lib/utils";
import {
  buildRangeSeries,
  rowsWindow,
} from "@/lib/transactionLedger";
import { useReimbursementOverview } from "../../hooks/useEmployeeReimbursement";
import { ReimbursementOverview } from "../../components/layout/admin/reimbursement/ReimbursementOverview";
import { ReimbursementPersonnelTable } from "../../components/layout/admin/reimbursement/ReimbursementPersonnelTable";

const AdminEmployeeReimbursement = () => {
  const { data, isLoading, error, refetch } = useReimbursementOverview();

  const moneyIn = Number(data?.moneyIn ?? 0);
  const given = Number(data?.given ?? 0);
  const givenSources = Number(data?.givenSources ?? 0);
  const abonoIn = Number(data?.abonoIn ?? 0);
  const abonoCount = Number(data?.abonoCount ?? 0);
  const budget = Number(data?.budget ?? 0);
  const issued = Number(data?.issued ?? 0);
  const openAbono = Number(data?.openAbono ?? 0);
  const spent = Number(data?.spent ?? 0);
  const settledAbonoCount = Number(data?.settledAbonoCount ?? 0);
  const personnelCount = Number(data?.personnelCount ?? 0);
  const abonoByEmployee = data?.abonoByEmployee ?? [];
  const timeline = data?.timeline ?? [];
  const personnel = data?.personnel ?? [];

  const cashOnHand = budget - issued - openAbono;
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

  const balanceStats = useMemo(
    () => [
      {
        key: "issued",
        label: "Issued",
        value: issued > 0 ? `-${formatMoney(issued)}` : formatMoney(0),
        tone: "warning",
      },
      {
        key: "expenses",
        label: "Spent",
        value: spent > 0 ? `-${formatMoney(spent)}` : formatMoney(0),
        tone: "danger",
      },
    ],
    [issued, spent],
  );

  const inEvents = useMemo(
    () => timeline.filter((e) => e.kind === "given"),
    [timeline],
  );
  const abonoEvents = useMemo(
    () => timeline.filter((e) => e.kind === "open"),
    [timeline],
  );
  const recordEvents = useMemo(
    () => timeline.filter((e) => e.kind === "open" || e.kind === "settled"),
    [timeline],
  );

  const inSeries = useMemo(
    () =>
      buildRangeSeries(rowsWindow(inEvents), inEvents, (r) => Number(r.amount) || 0, 7),
    [inEvents],
  );
  const abonoSeries = useMemo(
    () =>
      buildRangeSeries(rowsWindow(abonoEvents), abonoEvents, (r) => Number(r.amount) || 0, 7),
    [abonoEvents],
  );
  const recordSeries = useMemo(
    () => buildRangeSeries(rowsWindow(recordEvents), recordEvents, () => 1, 7),
    [recordEvents],
  );

  const recordStats = useMemo(
    () => [
      { key: "open", label: "Open", value: abonoCount, tone: "warning" },
      {
        key: "settled",
        label: "Settled",
        value: settledAbonoCount,
        tone: "success",
      },
      { key: "personnel", label: "Personnel", value: personnelCount },
    ],
    [abonoCount, settledAbonoCount, personnelCount],
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
            inSeries={inSeries}
            cashOnHand={cashOnHand}
            isBalanceOverdrawn={isBalanceOverdrawn}
            isBalanceDepleted={isBalanceDepleted}
            balanceStats={balanceStats}
            abono={{
              openTotal: openAbono,
              openCount: abonoCount,
              employees: abonoByEmployee,
            }}
            abonoSeries={abonoSeries}
            recordCount={abonoCount}
            recordSeries={recordSeries}
            recordStats={recordStats}
          />
          <ReimbursementPersonnelTable rows={personnel} isLoading={isLoading} />
        </>
      )}
    </div>
  );
};

export default AdminEmployeeReimbursement;
