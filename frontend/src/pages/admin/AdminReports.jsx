import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Download,
  Eye,
  History,
  Inbox,
  Landmark,
  Layers,
  ReceiptText,
  Scale,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { EmptyState, ErrorState } from "../../components/ui/DataState";
import Listbox from "../../components/ui/Listbox";
import { ReportPreviewModal } from "../../components/layout/admin/reports/ReportPreviewModal";
import { ReportTraceChart } from "../../components/layout/admin/reports/ReportTraceChart";
import {
  CategoryDonut,
  MonthlyFlowChart,
  SimpleBars,
  UtilizationBars,
} from "../../components/layout/admin/reports/ReportsCharts";
import { useTransactions } from "../../hooks/useTransactions";
import { useSourceFunds } from "../../hooks/useSourceFunds";
import { useAuditLogs } from "../../hooks/useAuditLogs";
import { useEmployeesOverview } from "../../hooks/useEmployees";
import {
  cn,
  emptyDateRange,
  formatDate,
  formatMoney,
  toISODate,
  toMoney,
} from "../../lib/utils";
import { CHART_EASE, statContainer, statItem } from "../../lib/dashboard";
import { downloadCSV, openPrintDocument } from "../../lib/reportExport";
import {
  ALL_FILTER,
  KIND_ORDER,
  actionBars,
  auditReport,
  categoryBreakdown,
  dailySeries,
  employeeBreakdown,
  employeeReport,
  expenseReport,
  financialReport,
  kindBreakdown,
  kindLabel,
  ledgerReport,
  moneyInOf,
  moneyOutOf,
  monthlySeries,
  pctDelta,
  previousWindow,
  rangeLabel,
  scopeRows,
  sourceBreakdown,
  sourceReport,
  sumRows,
} from "../../lib/reports";

/* ── AdminReports ─────────────────────────────────────────────────────────
   One library that turns the whole system into reports: the unified ledger
   (budgets, issuances, expenses, abono, transfers), the source-of-funds
   standing, employee activity and the audit trail. Every report follows the
   page filters, and each one previews (summary + chart + records), prints
   and downloads as CSV — all from the same builder so the numbers can never
   disagree. Data flows through the shared react-query keys, so socket money
   events refresh every figure live. */

const TILE_TONES = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  warning: "bg-[var(--warning)]/12 text-[var(--warning)]",
  success: "bg-[var(--success)]/12 text-[var(--success)]",
  neutral: "bg-[var(--surface-2)] text-[var(--ink-muted)]",
};

// Ghost block for skeleton layouts — same pulse language as the StatCard
// loader: soft surface-2 blocks that pulse out of the foreground.
const GhostBar = ({ className }) => (
  <div
    className={cn("animate-pulse rounded bg-[var(--surface-2)]", className)}
  />
);

/* Reports skeleton mirrors the live layout exactly: 4 stat cards, the
   spending-mix donut + trace-chart row, then the insights card beside the
   report-tile grid. Columns use the same stretch helpers so nothing
   reshuffles when the data lands. */
function ReportsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCard key={index} loading />
        ))}
      </div>

      {/* Row 1 — spending mix (donut) + movement analysis (trace chart) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
          <Card padding="lg" radius="lg" className="flex flex-col">
            <div className="mb-5">
              <GhostBar className="h-4 w-36" />
              <GhostBar className="mt-2 h-3 w-full" />
              <GhostBar className="mt-1.5 h-3 w-5/12" />
            </div>
            <div className="flex w-full flex-1 items-center">
              <div className="w-full">
                <GhostBar className="mx-auto h-44 w-44 rounded-full" />
                <ul className="mt-5 space-y-2.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <GhostBar className="h-2.5 w-2.5 shrink-0 rounded-full" />
                      <GhostBar className="h-3 min-w-0 flex-1" />
                      <GhostBar className="h-3 w-16 shrink-0" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-9 [&>div]:h-full">
          <Card padding="lg" radius="lg" className="flex flex-col">
            <div className="mb-3">
              <GhostBar className="h-4 w-36" />
              <GhostBar className="mt-2 h-3 w-2/3" />
            </div>
            <GhostBar className="mt-4 h-[240px] w-full rounded-2xl" />
          </Card>
        </div>
      </div>

      {/* Row 2 — utilization + top spenders (one card) / report library */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
          <Card padding="lg" radius="lg">
            <div className="mb-4">
              <GhostBar className="h-4 w-32" />
              <GhostBar className="mt-2 h-3 w-full" />
              <GhostBar className="mt-1.5 h-3 w-9/12" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <GhostBar className="h-3 w-24" />
                    <GhostBar className="h-3 w-20 shrink-0" />
                  </div>
                  <GhostBar className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>

            <div className="my-5 border-t border-[var(--border)]" />

            <div className="mb-4">
              <GhostBar className="h-4 w-28" />
              <GhostBar className="mt-2 h-3 w-10/12" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <GhostBar className="h-3 w-28" />
                    <GhostBar className="h-3 w-16 shrink-0" />
                  </div>
                  <GhostBar className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-9 [&>div]:h-full">
          <Card padding="lg" radius="lg" className="flex flex-col">
            <div className="mb-4">
              <GhostBar className="h-4 w-32" />
              <GhostBar className="mt-2 h-3 w-2/3" />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:auto-rows-fr sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <GhostBar className="h-10 w-10 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <GhostBar className="h-3.5 w-28" />
                      <GhostBar className="mt-2 h-3 w-full" />
                      <GhostBar className="mt-1.5 h-3 w-9/12" />
                    </div>
                  </div>
                  <GhostBar className="mt-4 h-3 w-24" />
                  <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] pt-3">
                    <GhostBar className="h-8 w-20 rounded-lg" />
                    <GhostBar className="h-8 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const AdminReports = () => {
  const [range, setRange] = useState(emptyDateRange);
  const [sourceFilter, setSourceFilter] = useState(ALL_FILTER);
  const [kindFilter, setKindFilter] = useState(ALL_FILTER);
  const [previewId, setPreviewId] = useState(null);

  // Ledger + supporting lists. All keys live under the realtime bridge, so
  // every socket money event refetches them without a manual refresh.
  // `includeClosed`: a report counts EVERY source of funds regardless of
  // status — the source filter and the utilization breakdown already list
  // closed references, so the figures must cover their records too. (The
  // operational ledger pages keep the closed-source no-footsteps gate.)
  const {
    transactions,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useTransactions({ includeClosed: true });
  const {
    sources: rawSources,
    isLoading: srcLoading,
    error: srcError,
    refetch: refetchSources,
  } = useSourceFunds();
  const {
    data: staff,
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff,
  } = useEmployeesOverview();

  // The audit endpoint filters by day window before slicing, so a range
  // really returns the in-range entries (up to the server's 200-row cap).
  const auditParams = useMemo(() => {
    const params = {
      limit: 200,
      tz: String(-new Date().getTimezoneOffset()),
    };
    if (range.start && range.end) {
      params.from = toISODate(range.start);
      params.to = toISODate(range.end);
    }
    return params;
  }, [range]);
  const {
    logs,
    total: auditTotal,
    isLoading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useAuditLogs(auditParams);

  /* ── Filtering + derived figures ─────────────────────────────────── */

  const scope = useMemo(
    () => ({ range, referenceId: sourceFilter, kind: kindFilter }),
    [range, sourceFilter, kindFilter],
  );
  const scopedRows = useMemo(
    () => scopeRows(transactions, scope),
    [transactions, scope],
  );
  const totals = useMemo(() => sumRows(scopedRows), [scopedRows]);

  // Same-length window right before the selection powers the delta badges.
  const prevWindow = useMemo(() => previousWindow(range), [range]);
  const prevTotals = useMemo(
    () =>
      prevWindow
        ? sumRows(scopeRows(transactions, { ...scope, range: prevWindow }))
        : null,
    [transactions, scope, prevWindow],
  );
  const deltas = useMemo(() => {
    if (!prevTotals) return {};
    return {
      moneyIn: pctDelta(totals.moneyIn, prevTotals.moneyIn),
      moneyOut: pctDelta(totals.moneyOut, prevTotals.moneyOut),
      net: pctDelta(totals.net, prevTotals.net),
      count: pctDelta(totals.count, prevTotals.count),
    };
  }, [totals, prevTotals]);

  // Stat-card sparklines — one bucket per active day in the current view.
  const sparkIn = useMemo(
    () => dailySeries(scopedRows, moneyInOf),
    [scopedRows],
  );
  const sparkOut = useMemo(
    () => dailySeries(scopedRows, moneyOutOf),
    [scopedRows],
  );
  const sparkNet = useMemo(
    () => dailySeries(scopedRows, (row) => moneyInOf(row) - moneyOutOf(row)),
    [scopedRows],
  );
  const sparkCount = useMemo(
    () => dailySeries(scopedRows, () => 1),
    [scopedRows],
  );

  const kinds = useMemo(() => kindBreakdown(scopedRows), [scopedRows]);
  const monthly = useMemo(() => monthlySeries(scopedRows), [scopedRows]);
  const categories = useMemo(() => categoryBreakdown(scopedRows), [scopedRows]);
  const paidTotal = useMemo(
    () => toMoney(categories.reduce((sum, entry) => sum + entry.total, 0)),
    [categories],
  );
  const people = useMemo(() => employeeBreakdown(scopedRows), [scopedRows]);
  const peopleSpent = useMemo(
    () => toMoney(people.reduce((sum, person) => sum + person.spent, 0)),
    [people],
  );
  const topSpenders = useMemo(
    () =>
      people
        .filter((person) => person.spent > 0)
        .slice(0, 6)
        .map((person) => ({
          key: person.key,
          label: person.name,
          hint: `${person.count} ${person.count === 1 ? "record" : "records"}`,
          value: person.spent,
        })),
    [people],
  );
  const sourceRows = useMemo(() => sourceBreakdown(rawSources), [rawSources]);
  const sourceRemaining = useMemo(
    () =>
      toMoney(sourceRows.reduce((sum, source) => sum + source.remaining, 0)),
    [sourceRows],
  );
  const auditBars = useMemo(() => actionBars(logs), [logs]);

  /* ── Report payloads + catalog ───────────────────────────────────── */

  const reports = useMemo(
    () => ({
      financial: financialReport(scopedRows, range),
      ledger: ledgerReport(scopedRows, range),
      expenses: expenseReport(scopedRows, range),
      sources: sourceReport(sourceRows),
      employees: employeeReport(scopedRows, range, staff),
      audit: auditReport(logs, range, auditTotal),
    }),
    [scopedRows, range, sourceRows, staff, logs, auditTotal],
  );

  const catalog = useMemo(
    () => [
      {
        id: "financial",
        title: "Financial Summary",
        description:
          "Money in, money out and the net position across every record type.",
        Icon: Wallet,
        tone: "accent",
        meta: `${formatMoney(totals.net)} net · ${totals.count} ${
          totals.count === 1 ? "record" : "records"
        }`,
        chart: monthly.length > 0 ? <MonthlyFlowChart data={monthly} /> : null,
      },
      {
        id: "ledger",
        title: "Transaction Ledger",
        description:
          "Every budget, issuance, expense, abono and transfer in the selected window.",
        Icon: ClipboardList,
        tone: "neutral",
        meta: `${totals.count} ${
          totals.count === 1 ? "record" : "records"
        } · ${formatMoney(totals.moneyIn + totals.moneyOut)} moved`,
        chart: null,
      },
      {
        id: "expenses",
        title: "Expense Report",
        description:
          "Paid spending grouped by category, with receipt-scan coverage and review flags.",
        Icon: ReceiptText,
        tone: "warning",
        meta: `${formatMoney(paidTotal)} spent · ${categories.length} ${
          categories.length === 1 ? "category" : "categories"
        }`,
        chart:
          categories.length > 0 ? (
            <CategoryDonut
              items={categories}
              centerValue={formatMoney(paidTotal)}
            />
          ) : null,
      },
      {
        id: "sources",
        title: "Source Utilization",
        description:
          "How each source of funds was allocated, issued, spent and what remains.",
        Icon: Landmark,
        tone: "success",
        meta: `${sourceRows.length} ${
          sourceRows.length === 1 ? "source" : "sources"
        } · ${formatMoney(sourceRemaining)} remaining`,
        chart:
          sourceRows.length > 0 ? <UtilizationBars items={sourceRows} /> : null,
      },
      {
        id: "employees",
        title: "Employee Activity",
        description:
          "Per-employee issued budget, spending, abono and transfers.",
        Icon: Users,
        tone: "neutral",
        meta: `${people.length} ${
          people.length === 1 ? "person" : "people"
        } · ${formatMoney(peopleSpent)} spent`,
        chart:
          topSpenders.length > 0 ? <SimpleBars items={topSpenders} /> : null,
      },
      {
        id: "audit",
        title: "Audit Trail",
        description:
          "System activity log — who did what, when, and to which record.",
        Icon: History,
        tone: "neutral",
        meta: `${Number(auditTotal) || 0} ${
          (Number(auditTotal) || 0) === 1 ? "event" : "events"
        } · ${rangeLabel(range) === "All time" ? "all time" : "in range"}`,
        chart:
          auditBars.length > 0 ? (
            <SimpleBars items={auditBars} formatValue={(value) => `${value}`} />
          ) : null,
      },
    ],
    [
      totals,
      monthly,
      paidTotal,
      categories,
      sourceRows,
      sourceRemaining,
      people,
      peopleSpent,
      topSpenders,
      auditBars,
      auditTotal,
      range,
    ],
  );

  const sourceOptions = useMemo(
    () => [
      { value: ALL_FILTER, label: "All sources" },
      ...rawSources.map((source) => ({
        value: source.reference_id,
        label: source.label || "Untitled source",
      })),
    ],
    [rawSources],
  );

  const kindOptions = useMemo(
    () => [
      { value: ALL_FILTER, label: "All types" },
      ...KIND_ORDER.map((kind) => ({ value: kind, label: kindLabel(kind) })),
    ],
    [],
  );

  /* ── Preview / export wiring ─────────────────────────────────────── */

  const activeEntry = previewId
    ? (catalog.find((entry) => entry.id === previewId) ?? null)
    : null;
  const activeReport = activeEntry ? reports[activeEntry.id] : null;
  const previewRowCells = useMemo(() => {
    if (!activeReport) return [];
    return activeReport.records.map((record) =>
      activeReport.columns.map((column) => record[column.key]),
    );
  }, [activeReport]);

  const exportReport = (entry) => {
    const report = reports[entry.id];
    if (!report) return;
    downloadCSV(
      `${entry.id}-report_${toISODate()}.csv`,
      report.columns,
      report.csvRecords ?? report.records,
    );
  };

  const exportLedger = () => exportReport({ id: "ledger" });

  const printReport = () => {
    if (!activeEntry || !activeReport) return;
    const opened = openPrintDocument({
      title: activeEntry.title,
      subtitle: `${rangeLabel(range)} · generated ${formatDate(new Date())}`,
      summaryRows: activeReport.summaryRows,
      table: {
        columns: activeReport.columns.map((column) => column.label),
        rows: previewRowCells,
      },
    });
    if (!opened) toast.error("Allow pop-ups to print this report");
  };

  const clearFilters = () => {
    setRange(emptyDateRange());
    setSourceFilter(ALL_FILTER);
    setKindFilter(ALL_FILTER);
  };

  /* ── States ──────────────────────────────────────────────────────── */

  const isLoading = txLoading || srcLoading || auditLoading || staffLoading;
  const hasError = txError || srcError || auditError || staffError;
  const isEmpty = transactions.length === 0 && rawSources.length === 0;
  const hasScopedRows = scopedRows.length > 0;

  const retryAll = () => {
    if (txError) refetchTx();
    if (srcError) refetchSources();
    if (auditError) refetchAudit();
    if (staffError) refetchStaff();
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Reports"
        description="Financial summaries, ledgers and breakdowns generated live from your records."
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <div className="w-full sm:w-60">
              {/* Fill the whole 240px slot like the neighbouring Listboxes —
                  the trigger used to hug its label, leaving a dead gap before
                  the next filter. Below `sm` it stays the compact icon chip. */}
              <DateRangePicker
                value={range}
                onChange={setRange}
                placeholder="All time"
                compactOnMobile
                className="sm:w-full sm:justify-start"
              />
            </div>
            <div className="w-full sm:w-44">
              <Listbox
                portal
                searchable={sourceOptions.length > 8}
                options={sourceOptions}
                value={sourceFilter}
                onChange={setSourceFilter}
                placeholder="All sources"
                variant="soft"
              />
            </div>
            <div className="w-full sm:w-40">
              <Listbox
                portal
                options={kindOptions}
                value={kindFilter}
                onChange={setKindFilter}
                placeholder="All types"
                variant="soft"
              />
            </div>
            <Button variant="soft" onClick={exportLedger}>
              <Download size={15} aria-hidden />
              CSV
            </Button>
          </div>
        }
      />

      {hasError ? (
        <Card padding="none">
          <ErrorState
            title="Couldn't load the reports"
            message="The ledger, the source of funds or the audit trail failed to load."
            onRetry={retryAll}
          />
        </Card>
      ) : isLoading ? (
        <ReportsSkeleton />
      ) : isEmpty ? (
        <Card padding="none">
          <EmptyState
            icon={Inbox}
            title="Nothing to report yet"
            message="Add a source of funds, issue budget or log expenses — the report library fills up automatically from every record."
          />
        </Card>
      ) : (
        <>
          {/* ── Stat strip — the four headline figures of the current view ── */}
          <motion.div
            variants={statContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
          >
            <motion.div
              variants={statItem}
              className="h-full min-w-0 [&>div]:h-full"
            >
              <StatCard
                label="Money in"
                value={formatMoney(totals.moneyIn)}
                icon={ArrowDownToLine}
                accent
                chart="bars"
                data={sparkIn}
                delta={deltas.moneyIn}
                deltaCaption="vs previous period"
                breakdownCaption="Budgets & abono in"
              />
            </motion.div>
            <motion.div
              variants={statItem}
              className="h-full min-w-0 [&>div]:h-full"
            >
              <StatCard
                label="Money out"
                value={formatMoney(totals.moneyOut)}
                icon={ArrowUpFromLine}
                tone="danger"
                chart="bars"
                data={sparkOut}
                delta={deltas.moneyOut}
                deltaCaption="vs previous period"
                deltaPolarity="up-bad"
                breakdownCaption="My expenses & employee expenses"
              />
            </motion.div>
            <motion.div
              variants={statItem}
              className="h-full min-w-0 [&>div]:h-full"
            >
              <StatCard
                label="Net position"
                value={formatMoney(totals.net)}
                icon={Scale}
                tone={totals.net >= 0 ? "success" : "danger"}
                chart="line"
                data={sparkNet}
                delta={deltas.net}
                deltaCaption="vs previous period"
                breakdownCaption="Remaining & Emp. CashOnHand"
              />
            </motion.div>
            <motion.div
              variants={statItem}
              className="h-full min-w-0 [&>div]:h-full"
            >
              <StatCard
                label="Records"
                value={String(totals.count)}
                icon={Layers}
                chart="bars"
                data={sparkCount}
                delta={deltas.count}
                deltaCaption="vs previous period"
                breakdownCaption={`Across ${kinds.length} record ${
                  kinds.length === 1 ? "type" : "types"
                }`}
              />
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
            {/* ── Left (~25%): spending mix ── */}
            <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
              <Card
                padding="lg"
                radius="lg"
                // flex column + centered body: the card matches the movement
                // panel's height, so the donut floats in the spare room.
                className="relative flex flex-col overflow-visible"
              >
                {/* Narrow card: title with its total wrapping over the
                    description so nothing squeezes at ~25% width. */}
                <CardHeader className="flex-col items-start gap-2">
                  <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <CardTitle>Spending by category</CardTitle>
                    <Badge tone="warning">{formatMoney(paidTotal)}</Badge>
                  </div>
                  <CardDescription className="text-balance">
                    Paid expenses in the current view, biggest first.
                  </CardDescription>
                </CardHeader>
                <div className="flex w-full flex-1 items-center">
                  <CategoryDonut
                    items={categories}
                    centerLabel="Paid spend"
                    centerValue={formatMoney(paidTotal)}
                    // Narrow column: always donut-over-legend — a
                    // side-by-side pair would squeeze both at ~25% width.
                    stacked
                  />
                </div>
              </Card>
            </div>

            {/* ── Right (~75%): movement analysis ── */}
            <div className="min-w-0 lg:col-span-9 [&>div]:h-full">
              <Card
                padding="lg"
                radius="lg"
                className="relative overflow-visible"
              >
                <CardHeader className="mb-3">
                  <div>
                    <CardTitle>Movement analysis</CardTitle>
                    <CardDescription>
                      Cumulative money in vs out, and where each type of record
                      moved money.
                    </CardDescription>
                  </div>
                  <Badge tone="neutral">
                    {totals.count} {totals.count === 1 ? "record" : "records"}
                  </Badge>
                </CardHeader>
                {hasScopedRows ? (
                  <ReportTraceChart rows={scopedRows} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
                    <p className="text-sm text-[var(--ink-muted)]">
                      No records match the current filters.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: CHART_EASE, delay: 0.12 }}
            className="space-y-4 sm:space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
              {/* ── Left (~25%): source utilization + top spenders stacked
                  in a single card ── */}
              <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
                <Card
                  padding="lg"
                  radius="lg"
                  className="relative overflow-visible"
                >
                  {/* Narrow card: title with its figure wrapping over the
                      description so nothing squeezes at ~25% width. */}
                  <CardHeader className="flex-col items-start gap-2">
                    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <CardTitle>Source utilization</CardTitle>
                      <Badge tone="success">
                        {formatMoney(sourceRemaining)} left
                      </Badge>
                    </div>
                    <CardDescription className="text-balance">
                      Deployed share of every source of funds — issued plus
                      spent against allocated.
                    </CardDescription>
                  </CardHeader>
                  <div className="scrollbar-inline max-h-[320px] overflow-y-auto pr-1">
                    <UtilizationBars items={sourceRows} />
                  </div>

                  {/* Top spenders — second half of the same card */}
                  <CardHeader className="mt-5 flex-col items-start gap-2 border-t border-[var(--border)] pt-5">
                    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <CardTitle>Top spenders</CardTitle>
                      <Badge tone="neutral">{people.length} involved</Badge>
                    </div>
                    <CardDescription className="text-balance">
                      Employees by paid expense amount in the current view.
                    </CardDescription>
                  </CardHeader>
                  <div className="scrollbar-inline max-h-[320px] overflow-y-auto pr-1">
                    <SimpleBars
                      items={topSpenders}
                      emptyText="No employee spending in the current view."
                    />
                  </div>
                </Card>
              </div>

              {/* ── Right (~75%): report library ── */}
              <div className="min-w-0 lg:col-span-9 [&>div]:h-full">
                <Card
                  padding="lg"
                  radius="lg"
                  // flex column so the tile grid fills the card when the
                  // row is stretched to the utilization card's height.
                  className="relative flex flex-col overflow-visible"
                >
                  <CardHeader className="mb-4">
                    <div>
                      <CardTitle>Report library</CardTitle>
                      <CardDescription>
                        Each report follows the filters above — preview it,
                        print it, or download the CSV.
                      </CardDescription>
                    </div>
                    <Badge tone="success">Live</Badge>
                  </CardHeader>
                  <motion.div
                    variants={statContainer}
                    initial="hidden"
                    animate="show"
                    className="grid flex-1 grid-cols-1 gap-3 sm:auto-rows-fr sm:grid-cols-2"
                  >
                    {catalog.map((entry) => (
                      <motion.div
                        key={entry.id}
                        variants={statItem}
                        whileHover={{ y: -3 }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 26,
                        }}
                        className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-[border-color,box-shadow] hover:border-[var(--accent)]/30 hover:shadow-hover"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                              TILE_TONES[entry.tone],
                            )}
                          >
                            <entry.Icon size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-sm font-medium tracking-tight text-[var(--ink)]">
                              {entry.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                              {entry.description}
                            </p>
                          </div>
                        </div>
                        <p className="mb-3 mt-3 truncate text-xs font-medium tabular-nums text-[var(--accent-strong)]">
                          {entry.meta}
                        </p>
                        <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] pt-3">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => setPreviewId(entry.id)}
                          >
                            <Eye size={14} aria-hidden />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReport(entry)}
                          >
                            <Download size={14} aria-hidden />
                            CSV
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </Card>
              </div>
            </div>
          </motion.div>
        </>
      )}

      <ReportPreviewModal
        open={Boolean(activeEntry && activeReport)}
        onClose={() => setPreviewId(null)}
        title={activeEntry?.title}
        subtitle={
          activeEntry ? `${activeEntry.meta} · ${rangeLabel(range)}` : ""
        }
        summaryRows={activeReport?.summaryRows ?? []}
        columns={(activeReport?.columns ?? []).map((column) => column.label)}
        rows={previewRowCells}
        totalOut={activeReport?.totalOut}
        totalOutLabel={activeReport?.totalOutLabel}
        chart={activeEntry?.chart ?? null}
        onPrint={printReport}
        onDownloadCSV={() => activeEntry && exportReport(activeEntry)}
      />
    </div>
  );
};

export default AdminReports;
