import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Inbox, SquareArrowOutUpRight } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { EmptyState, ErrorState } from "../../components/ui/DataState";
import Listbox from "../../components/ui/Listbox";
import {
  PoolInsightsPanel,
  RecentTransactionsCard,
} from "../../components/layout/admin/dashboard/ActivityPanels";
import RemainingPanel from "../../components/layout/admin/dashboard/RemainingPanel";
import TransactionGraphPanel from "../../components/layout/admin/dashboard/TransactionGraphPanel";
import DashboardSkeleton from "../../components/layout/admin/dashboard/DashboardSkeleton";
import { useSourceFunds } from "../../hooks/useSourceFunds";
import { useTransactions } from "../../hooks/useTransactions";
import {
  formatDate,
  formatMoney,
  formatTime,
  toMoney,
} from "../../lib/utils";
import {
  ALL_SOURCES,
  SERIES,
  shortDay,
  statItem,
  statContainer,
} from "../../lib/dashboard";

const AdminDashboard = () => {
  const nav = useNavigate();
  const [selected, setSelected] = useState(ALL_SOURCES);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Both queries live under the realtime bridge (["budgets"] / ["transactions"]
  // are invalidated on every money event), so the panel and the graph stream
  // in new figures without a manual refresh.
  const {
    sources,
    isLoading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
  } = useSourceFunds();
  const {
    transactions,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useTransactions();

  const openSources = useMemo(
    () => (sources ?? []).filter((s) => (s.status ?? "open") === "open"),
    [sources],
  );

  // The picker only ever offers open sources; a selection that was closed or
  // deleted while viewing falls back to the combined view instead of breaking.
  const activeId = openSources.some((s) => s.reference_id === selected)
    ? selected
    : ALL_SOURCES;
  const activeSource =
    activeId === ALL_SOURCES
      ? null
      : (openSources.find((s) => s.reference_id === activeId) ?? null);

  // Rows inside the selected scope: the four money legs of OPEN sources only —
  // transfers are employee-to-employee moves that never touch the pool.
  const scopeRows = useMemo(() => {
    const rows = (transactions ?? []).filter((row) => {
      if (!["budget", "issued", "expense", "abono"].includes(row.kind))
        return false;
      if (!row.referenceId) return false;
      return activeId === ALL_SOURCES
        ? openSources.some((s) => s.reference_id === row.referenceId)
        : row.referenceId === activeId;
    });
    return rows.sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));
  }, [transactions, activeId, openSources]);

  // Headline totals — equal to the last point's cumulative values, so the
  // stat strip always agrees with the chart.
  const totals = useMemo(
    () =>
      scopeRows.reduce(
        (acc, row) => ({
          allocated: acc.allocated + SERIES[0].pick(row),
          issued: acc.issued + SERIES[1].pick(row),
          spent: acc.spent + SERIES[2].pick(row),
          abono: acc.abono + SERIES[3].pick(row),
        }),
        { allocated: 0, issued: 0, spent: 0, abono: 0 },
      ),
    [scopeRows],
  );

  // One point PER TRANSACTION — every money movement pins a dot on each leg's
  // line, so the graph doubles as a map of the ledger: hover any point to
  // read the transaction and the running figures at that exact moment.
  const chartData = useMemo(() => {
    const running = { allocated: 0, issued: 0, spent: 0, abono: 0 };
    return scopeRows.map((row) => {
      running.allocated += SERIES[0].pick(row);
      running.issued += SERIES[1].pick(row);
      running.spent += SERIES[2].pick(row);
      running.abono += SERIES[3].pick(row);
      const cumAllocated = toMoney(running.allocated);
      const cumIssued = toMoney(running.issued);
      const cumSpent = toMoney(running.spent);
      const cumAbono = toMoney(running.abono);
      return {
        ts: new Date(row.date).getTime(),
        label: shortDay(row.date),
        fullDate: `${formatDate(row.date)} · ${formatTime(row.date)}`,
        title: row.description || "Transaction",
        amount: Number(row.amount) || 0,
        signed: row.direction === "in" ? "+" : "−",
        cumAllocated,
        cumIssued,
        cumSpent,
        cumAbono,
        net: toMoney(cumAllocated + cumAbono - cumIssued - cumSpent),
      };
    });
  }, [scopeRows]);

  // Hover probe feeds the graph's floating subline only — the stat strip
  // below keeps showing the live totals at all times.
  const hoverPoint =
    hoverIndex != null &&
    Number.isInteger(hoverIndex) &&
    chartData[hoverIndex] != null
      ? chartData[hoverIndex]
      : null;

  const remainingTotal = useMemo(
    () =>
      toMoney(
        openSources.reduce((sum, s) => sum + (Number(s.remaining) || 0), 0),
      ),
    [openSources],
  );

  // Composition of the pool for the hero breakdown bar — what happened to the
  // open sources' money: handed out, spent, or still sitting as balance.
  const flow = useMemo(
    () =>
      openSources.reduce(
        (acc, s) => ({
          issued: acc.issued + (Number(s.issued) || 0),
          spent: acc.spent + (Number(s.expenses) || 0),
          remaining: acc.remaining + Math.max(Number(s.remaining) || 0, 0),
        }),
        { issued: 0, spent: 0, remaining: 0 },
      ),
    [openSources],
  );

  const isLoading = sourcesLoading || txLoading;
  const hasError = Boolean(sourcesError || txError);

  const sourceOptions = useMemo(
    () => [
      { value: ALL_SOURCES, label: "All Sources" },
      ...openSources.map((s) => ({ value: s.reference_id, label: s.label })),
    ],
    [openSources],
  );

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Dashboard"
        description="Live remaining balance and money movement across your open budget sources."
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <div className="w-full sm:w-52">
              <Listbox
                portal
                searchable={sourceOptions.length > 8}
                options={sourceOptions}
                value={activeId}
                onChange={setSelected}
                placeholder="Select source"
                variant="soft"
              />
            </div>
            <Button variant="accent" onClick={() => nav("/admin/source-funds")}>
              Create Source
              <SquareArrowOutUpRight size={15} />
            </Button>
          </div>
        }
      />

      {hasError ? (
        <Card padding="none">
          <ErrorState
            title="Couldn't load the dashboard"
            message="The budget figures or the transaction ledger failed to load."
            onRetry={() => {
              if (sourcesError) refetchSources();
              if (txError) refetchTx();
            }}
          />
        </Card>
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : openSources.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Inbox}
            title="No open budget sources"
            message="Create a source of funds and add budgets to see the live balance and movement graph here."
          />
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {/* ── Stat strip — four money legs, shared StatCard format ──
              Same card as AdminBudget/AdminExpenses: big display figure
              (count-up rolls on every live update), same icon tile size/
              stroke, delta badge for the latest move, and the shared
              sparkline of each leg's trajectory. */}
          <motion.div
            variants={statContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
          >
            {SERIES.map((s) => (
              <motion.div
                key={s.key}
                variants={statItem}
                className="h-full min-w-0 [&>div]:h-full"
              >
                <StatCard
                  label={s.label}
                  value={formatMoney(totals[s.totalKey])}
                  icon={s.Icon}
                  tone={s.tone}
                  breakdownCaption={s.caption}
                  chart="bars"
                  data={chartData.map((p) => ({ v: p[s.key] }))}
                />
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
            {/* ── Left (~25%): remaining balance for open sources ── */}
            <div className="lg:col-span-3">
              <RemainingPanel
                total={remainingTotal}
                flow={flow}
                sources={openSources}
                selected={activeId}
              />
            </div>

            {/* ── Right (~75%): live line graph pinned per transaction ── */}
            <div className="lg:col-span-9">
              <TransactionGraphPanel
                activeId={activeId}
                activeSource={activeSource}
                windowData={chartData}
                hoverPoint={hoverPoint}
                onHover={setHoverIndex}
                onHoverEnd={() => setHoverIndex(null)}
                rowCount={scopeRows.length}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
            {/* ── Left (~25%): open-budget holders + category spend ranking ── */}
            <div className="lg:col-span-3">
              <PoolInsightsPanel
                transactions={transactions}
                openSources={openSources}
                isLoading={isLoading}
              />
            </div>
            {/* ── Right (~75%): the 15 newest ledger records ── */}
            <div className="lg:col-span-9">
              <RecentTransactionsCard
                transactions={transactions}
                isLoading={txLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
