import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  CalendarX2,
  ClipboardList,
  EllipsisVertical,
  Eye,
  HandCoins,
  Inbox,
  Lock,
  PhilippinePeso,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import toast from "react-hot-toast";

import { PageHeader } from "../../../ui/PageHeader";
import { Button } from "../../../ui/Button";
import { StatCard } from "../../../ui/StatCard";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { EmptyState } from "../../../ui/DataState";
import { SearchInput } from "../../../ui/Input";
import { DateRangePicker } from "../../../ui/DateRangePicker";
import { Tabs, TabsList, TabsTrigger } from "../../../ui/Tabs";
import Listbox from "../../../ui/Listbox";
import { IconButton } from "../../../ui/IconButton";
import {
  FilterChips,
  FilterSheet,
  FilterSheetField,
} from "../../../ui/MobileFilters";

import { useSourceFunds } from "../../../../hooks/useSourceFunds";
import { useTransactions } from "../../../../hooks/useTransactions";
import {
  cn,
  emptyDateRange,
  formatDate,
  formatMoney,
  formatTime,
  matchesDayRange,
  toMoney,
} from "@/lib/utils";
import {
  TRANSACTION_DIRECTION_OPTIONS,
  TRANSACTION_KIND_META,
  TRANSACTION_TYPE_OPTIONS,
  SYSTEM_EMPLOYEE_VALUE,
  TYPE_TABS,
} from "@/constants";
import { matchesFilters, shortRangeLabel } from "@/lib/transactionLedger";
import { InvolvedStack, StatusBadge } from "./SourceBadges";
import { TransactionLedger } from "../transactions/TransactionLedger";
import TransactionDetailsModal from "../transactions/TransactionDetailsModal";
import SourcePreviewModal from "./SourcePreviewModal";

const PAGE_SIZE = 50;

/**
 * AdminSourceFundsOverview
 * Comprehensive executive overview for a single Source of Funds.
 * Displays validated financial balances, multi-segment animated utilization bar,
 * activity trajectory charts, and a read-only transaction ledger.
 */
export function AdminSourceFundsOverview() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // The reference in the URL is the single source of truth: `?ref=` wins
  // over any history state, so a deep or shared link always opens exactly
  // the source it names (state only bridges in-app navigations that lack
  // the param).
  const referenceId =
    searchParams.get("ref") ??
    searchParams.get("referenceId") ??
    location.state?.referenceId ??
    null;

  // Source of Funds data hook
  const {
    sources,
    isLoading: isSourceLoading,
    refetch: refetchSources,
  } = useSourceFunds();

  // Match on the id alone — a label is NOT unique (two sources can share
  // one), so the overview must never resolve a source by its label.
  const source = useMemo(
    () =>
      (sources ?? []).find(
        (s) => String(s.reference_id) === String(referenceId ?? "").trim(),
      ) ?? null,
    [sources, referenceId],
  );

  // Transactions ledger data (read-only). `includeClosed` lifts the
  // backend's "closed sources leave no footsteps" gate so this page still
  // charts and lists a closed source's full history — including budget
  // issued rows. Scoped to this overview: every other ledger page keeps
  // them hidden.
  const {
    transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions({ includeClosed: true });

  // Filter & UI States
  const [dateRange, setDateRange] = useState(() => emptyDateRange());
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartMode, setChartMode] = useState("cumulative"); // 'cumulative' | 'balance'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Details Modal state
  const [viewRow, setViewRow] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Budget source preview modal (header action)
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const rangeLabel = shortRangeLabel(dateRange);

  // Cut-off notice: shown whenever a valid cut-off date is set — compared
  // against TODAY only, never against creation (a backdated cut-off before
  // its own creation is still real and already due). Three states — past
  // dates read as already due (danger), today reads as due today (warning),
  // future dates read as scheduled (warning, never "already due" and never
  // the informational accent tone — a deadline is a caution, not info).
  // Plain derivation (no hook): it must run before the early returns below.
  const { hasCutOff, cutOffDue, cutOffToday } = (() => {
    const none = { hasCutOff: false, cutOffDue: false, cutOffToday: false };
    if (!source?.date_cut_off) return none;
    const day = new Date(source.date_cut_off);
    if (Number.isNaN(day.getTime())) return none;
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today)
      return { hasCutOff: true, cutOffDue: true, cutOffToday: false };
    if (day.getTime() === today.getTime())
      return { hasCutOff: true, cutOffDue: false, cutOffToday: true };
    return { hasCutOff: true, cutOffDue: false, cutOffToday: false };
  })();

  // Closed-source flag: a source flipped to 'cut_off' (badged "Closed") is
  // done — no new activity can be recorded against it, so its banner must
  // say so instead of reading out a cut-off deadline that no longer applies.
  const isClosed = (source?.status ?? "open") !== "open";

  // Transactions belonging to this source — scoped by reference id, never
  // by label alone: two sources can share a label (e.g. a closed "Employee
  // Budget" next to an open one), and a label fallback would blend their
  // ledgers. A row that carries a reference id belongs to exactly one
  // source, so the id is authoritative; the label only catches legacy rows
  // that have no reference id at all.
  const sourceRows = useMemo(() => {
    if (!source && !referenceId) return [];
    const targetRefId = String(source?.reference_id ?? referenceId ?? "");
    const targetLabel = source?.label?.toLowerCase().trim();

    return (transactions ?? []).filter((row) => {
      if (row.referenceId) {
        return String(row.referenceId) === targetRefId;
      }
      return Boolean(
        targetLabel && row.referenceLabel?.toLowerCase().trim() === targetLabel,
      );
    });
  }, [transactions, source, referenceId]);

  // Dropdown filter options
  const employeeOptions = useMemo(() => {
    const seen = new Map();
    const hasSystem = sourceRows.some(
      (row) => !row.employeeId && row.kind === "budget",
    );
    for (const row of sourceRows) {
      if (!row.employeeId) continue;
      if (!seen.has(row.employeeId)) {
        seen.set(row.employeeId, {
          value: row.employeeId,
          label: row.employeeName || "Unknown",
          avatar: row.employeeAvatar || "",
        });
      }
    }
    return [
      { value: "all", label: "All employees" },
      ...(hasSystem
        ? [{ value: SYSTEM_EMPLOYEE_VALUE, label: "Boss (Allocation)" }]
        : []),
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [sourceRows]);

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    for (const row of sourceRows) {
      if (!row.categoryId || seen.has(row.categoryId)) continue;
      seen.set(row.categoryId, {
        value: row.categoryId,
        label: row.categoryName || "Uncategorized",
      });
    }
    return [
      { value: "all", label: "All categories" },
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [sourceRows]);

  const statusOptions = useMemo(() => {
    const seen = new Map();
    for (const row of sourceRows) {
      if (!row.status || seen.has(row.status)) continue;
      const label = String(row.status).replace(/_/g, " ");
      seen.set(row.status, {
        value: row.status,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return [
      { value: "all", label: "All statuses" },
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [sourceRows]);

  // Current draft filter configuration
  const draft = useMemo(
    () => ({
      type: tab,
      direction,
      employee,
      reference: "all",
      category,
      status,
    }),
    [tab, direction, employee, category, status],
  );

  // Date range filtering
  const dateFilteredRows = useMemo(
    () =>
      sourceRows.filter((row) =>
        matchesDayRange(row.date, dateRange?.start, dateRange?.end),
      ),
    [sourceRows, dateRange],
  );

  // Full filtering with text search query
  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return dateFilteredRows.filter((row) => matchesFilters(row, draft, query));
  }, [dateFilteredRows, draft, debouncedSearch]);

  // Financial reconciliation & validation
  const allocated = Number(source?.allocated) || 0;
  const issued = Number(source?.issued) || 0;
  const directExpenses = Number(source?.expenses) || 0;
  const employeeExpenses = Number(source?.employeeExpenses) || 0;
  const settledAbono = Number(source?.settledAbono) || 0;
  const forwarded = Number(source?.forwarded) || 0;

  // Total liquidated spend across all legs
  const spentTotal = toMoney(directExpenses + employeeExpenses + settledAbono);

  // Exact remaining balance from pool equation (allocated − issued − directExpenses + forwarded)
  const remaining = toMoney(
    source?.remaining ??
      Math.max(0, allocated - issued - directExpenses + forwarded),
  );

  // Balanced used amount representing actual deductions from the pool
  const balancedUsed = toMoney(allocated - remaining);
  const isOverBudget = remaining < 0 || balancedUsed > allocated;

  // Percentage calculations
  const issuedPct = allocated > 0 ? (issued / allocated) * 100 : 0;
  const directExpensesPct =
    allocated > 0 ? (directExpenses / allocated) * 100 : 0;
  const remainingPct =
    allocated > 0
      ? Math.max(0, Math.min(100, (remaining / allocated) * 100))
      : 0;
  const usedPct =
    allocated > 0 ? Math.max(0, (balancedUsed / allocated) * 100) : 0;

  // Visual segment proportions inside progress bar
  const clampedUsedPct = Math.min(100, usedPct);
  const issuedSegPct = Math.min(issuedPct, clampedUsedPct);
  const expensesSegPct = Math.max(0, clampedUsedPct - issuedSegPct);

  // Chronological activity points for chart
  const activityData = useMemo(() => {
    const short = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    const full = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return `${formatDate(iso)} · ${formatTime(iso)}`;
    };
    const round = (n) => Math.round(n * 100) / 100;
    const sorted = [...sourceRows].sort(
      (a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0),
    );

    // If sourceRows does not log initial budget rows, start cumAllocated at allocated
    const hasBudgetTx = sorted.some((r) => r.kind === "budget");
    const baseAllocated = hasBudgetTx ? 0 : allocated;
    const inOf = (r) => (r.kind === "budget" ? Number(r.moneyIn) || 0 : 0);
    const issuedOf = (r) => (r.kind === "issued" ? Number(r.moneyOut) || 0 : 0);
    const spentOf = (r) =>
      r.kind === "expense" || (r.kind === "abono" && r.status === "settled")
        ? Number(r.moneyOut) || 0
        : 0;
    const cumSum = (head, pick) =>
      round(head.reduce((sum, r) => sum + pick(r), 0));

    return sorted.map((row, i) => {
      const head = sorted.slice(0, i + 1);
      const cumAllocated = round(baseAllocated + cumSum(head, inOf));
      const cumIssued = cumSum(head, issuedOf);
      const cumSpent = cumSum(head, spentOf);
      const balance = round(cumAllocated - cumIssued - cumSpent);

      return {
        label: short(row.date),
        fullDate: full(row.date),
        title: row.description || "Transaction",
        status: row.status || "",
        amount: Number(row.amount) || 0,
        signed:
          row.direction === "in" ? "+" : row.direction === "out" ? "−" : "",
        cumAllocated,
        cumIssued,
        cumSpent,
        balance,
        kindLabel:
          TRANSACTION_KIND_META[row.kind]?.label ?? row.kind ?? "record",
      };
    });
  }, [sourceRows, allocated]);

  // Mobile match counter
  const countLedgerMatches = useCallback(
    (candidate) => {
      const q = debouncedSearch.trim().toLowerCase();
      return dateFilteredRows.filter((row) =>
        matchesFilters(row, { ...candidate, reference: "all" }, q),
      ).length;
    },
    [dateFilteredRows, debouncedSearch],
  );

  // Pagination calculations
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredRows, currentPage],
  );
  const rangeStart =
    filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRows.length, (currentPage + 1) * PAGE_SIZE);

  // Active filters check & reset
  const hasActiveFilters =
    hasDateRange ||
    tab !== "all" ||
    direction !== "all" ||
    employee !== "all" ||
    category !== "all" ||
    status !== "all" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setDateRange(emptyDateRange());
    setTab("all");
    setDirection("all");
    setEmployee("all");
    setCategory("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  const mobileFilterChips = useMemo(() => {
    const filterLabels = {
      direction: TRANSACTION_DIRECTION_OPTIONS.find(
        (o) => o.value === direction,
      )?.label,
      employee: employeeOptions.find((o) => o.value === employee)?.label,
      category: categoryOptions.find((o) => o.value === category)?.label,
      status: statusOptions.find((o) => o.value === status)?.label,
    };

    const chips = [];
    if (tab !== "all") {
      chips.push({
        key: "type",
        label: TYPE_TABS.find((t) => t.value === tab)?.label ?? "Type",
        onClear: () => {
          setTab("all");
          setPage(0);
        },
      });
    }
    const entries = [
      ["direction", direction, setDirection],
      ["employee", employee, setEmployee],
      ["category", category, setCategory],
      ["status", status, setStatus],
    ];
    for (const [key, active, setActive] of entries) {
      if (active === "all") continue;
      chips.push({
        key,
        label: filterLabels[key] ?? key,
        onClear: () => {
          setActive("all");
          setPage(0);
        },
      });
    }
    return chips;
  }, [
    tab,
    direction,
    employee,
    category,
    status,
    employeeOptions,
    categoryOptions,
    statusOptions,
  ]);

  const handleAction = (action, row) => {
    if (action !== "view") return;
    setViewRow(row);
    setViewOpen(true);
  };

  const backToList = () => nav("/admin/source-funds");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSources(), refetchTransactions()]);
      toast.success("Source overview refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // State guards
  if (!referenceId) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        <EmptyState
          icon={Inbox}
          title="No source selected"
          message="Open a source from the Source of Funds list to see its overview."
          onClear={backToList}
          clearLabel="Back to sources"
        />
      </div>
    );
  }

  if (isSourceLoading) {
    return <SourceOverviewSkeleton onBack={backToList} />;
  }

  if (!source) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        <EmptyState
          icon={Inbox}
          title="Source not found"
          message="It may have been deleted, or the link is out of date."
          onClear={backToList}
          clearLabel="Back to sources"
        />
      </div>
    );
  }

  const healthMeta = isOverBudget
    ? {
        tone: "danger",
        label: "Over Budget",
        desc: `Exceeded allocation by ${formatMoney(Math.abs(remaining))}`,
      }
    : usedPct >= 95
      ? {
          tone: "danger",
          label: "Near Exhaustion",
          desc: "Critical pool utilization",
        }
      : usedPct >= 80
        ? {
            tone: "warning",
            label: "High Utilization",
            desc: "Approaching total allocation ceiling",
          }
        : usedPct >= 40
          ? {
              tone: "accent",
              label: "Healthy Drawdown",
              desc: "Moderate and paced utilization",
            }
          : {
              tone: "success",
              label: "Optimal Reserves",
              desc: "Substantial funds available for allocation",
            };

  return (
    <div className="space-y-6 pb-6">
      {/* ── Page Header ── */}
      <SourceOverviewHeader
        source={source}
        hasCutOff={hasCutOff}
        cutOffDue={cutOffDue}
        cutOffToday={cutOffToday}
        isRefreshing={isRefreshing}
        onBack={backToList}
        onRefresh={handleRefresh}
        onPreview={() => setPreviewOpen(true)}
      />

      {/* ── Cut-off / closed notice banner — unmissable, directly under the
          header. A closed source overrides every date-based variant with the
          done message (the deadline no longer applies) and reads in the
          informational accent tone — a done state, not an alarm. Open
          sources keep the date reads: scheduled in accent, due-today in
          warning, past-due in danger. */}
      {(isClosed || hasCutOff) &&
        (() => {
          const scheduled = !cutOffDue && !cutOffToday;
          const tone =
            isClosed || scheduled
              ? {
                  frame: "border-[var(--accent)]/25 bg-[var(--accent-soft)]/40",
                  icon: "text-[var(--accent-strong)]",
                  title: "text-[var(--accent-strong)]",
                  body: "text-[var(--accent-strong)]",
                }
              : cutOffDue
                ? {
                    frame: "border-[var(--danger)]/40 bg-[var(--danger)]/10",
                    icon: "text-[var(--danger)]",
                    title: "text-[var(--danger)]",
                    body: "text-[var(--danger)]/90",
                  }
                : {
                    frame: "border-[var(--warning)]/40 bg-[var(--warning)]/10",
                    icon: "text-[var(--warning)]",
                    title: "text-[var(--warning)]",
                    body: "text-[var(--warning)]/90",
                  };
          return (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              role="alert"
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-card ${tone.frame}`}
            >
              {isClosed ? (
                <Lock
                  size={18}
                  aria-hidden
                  className={`mt-0.5 shrink-0 ${tone.icon}`}
                />
              ) : (
                <CalendarX2
                  size={18}
                  aria-hidden
                  className={`mt-0.5 shrink-0 ${tone.icon}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${tone.title}`}>
                  {isClosed
                    ? "Budget source already closed"
                    : cutOffDue
                      ? `Cut-off date already due — ${formatDate(source.date_cut_off)}`
                      : cutOffToday
                        ? `Today is the due date — ${formatDate(source.date_cut_off)}`
                        : `Cut-off date notice — ${formatDate(source.date_cut_off)}`}
                </p>
                <p className={`mt-0.5 text-xs leading-relaxed ${tone.body}`}>
                  {isClosed
                    ? "This source is done and transactions are closed — no new budgets, issuances, or expenses can be recorded. Existing records stay viewable below."
                    : cutOffDue
                      ? "This source no longer accepts new budgets, issuances, or expenses. Existing records stay viewable."
                      : cutOffToday
                        ? "Today is the last day this source accepts new budgets, issuances, or expenses."
                        : "This source stops accepting new budgets, issuances, or expenses on the date above."}
                </p>
              </div>
            </motion.div>
          );
        })()}

      {/* ── Executive Financial Stat Cards ── */}
      <SourceStatCards
        allocated={allocated}
        remaining={remaining}
        issued={issued}
        spentTotal={spentTotal}
        isClosed={isClosed}
        transactionCount={sourceRows.length || source.transactions || 0}
        involvedCount={
          Array.isArray(source.involved) ? source.involved.length : 0
        }
        budgetsCount={Number(source.budgets) || 0}
        isOverBudget={isOverBudget}
        remainingPct={remainingPct}
        issuedPct={issuedPct}
      />

      {/* ── Budget Utilization & Trajectory Card ── */}
      <SourceUtilizationCard
        allocated={allocated}
        balancedUsed={balancedUsed}
        usedPct={usedPct}
        isOverBudget={isOverBudget}
        healthMeta={healthMeta}
        issued={issued}
        issuedPct={issuedPct}
        directExpenses={directExpenses}
        directExpensesPct={directExpensesPct}
        remaining={remaining}
        remainingPct={remainingPct}
        forwarded={forwarded}
        clampedUsedPct={clampedUsedPct}
        issuedSegPct={issuedSegPct}
        expensesSegPct={expensesSegPct}
        employeeExpenses={employeeExpenses}
        settledAbono={settledAbono}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        activityData={activityData}
        isTransactionsLoading={isTransactionsLoading}
      />

      {/* ── Related Transactions Ledger Section ── */}
      <SourceLedgerSection
        tab={tab}
        onTabChange={(v) => {
          setTab(v);
          setPage(0);
        }}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        dateRange={dateRange}
        onDateRangeChange={(r) => {
          setDateRange(r);
          setPage(0);
        }}
        direction={direction}
        onDirectionChange={(v) => {
          setDirection(v);
          setPage(0);
        }}
        employee={employee}
        onEmployeeChange={(v) => {
          setEmployee(v);
          setPage(0);
        }}
        category={category}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(0);
        }}
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(0);
        }}
        employeeOptions={employeeOptions}
        categoryOptions={categoryOptions}
        statusOptions={statusOptions}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        mobileFilterChips={mobileFilterChips}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        hasDateRange={hasDateRange}
        rangeLabel={rangeLabel}
        isTransactionsLoading={isTransactionsLoading}
        transactionsError={transactionsError}
        onRetry={refetchTransactions}
        pageRows={pageRows}
        filteredRows={filteredRows}
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onAction={handleAction}
        countLedgerMatches={countLedgerMatches}
        draft={draft}
        totalDateRows={dateFilteredRows.length}
      />

      {/* ── Read-only Transaction Details Modal ── */}
      <TransactionDetailsModal
        open={viewOpen}
        row={viewRow}
        onClose={() => setViewOpen(false)}
      />

      {/* ── Budget Source Preview Modal (header action) ── */}
      <SourcePreviewModal
        open={previewOpen}
        source={source}
        rows={sourceRows}
        isClosed={isClosed}
        allocated={allocated}
        remaining={remaining}
        issued={issued}
        spentTotal={spentTotal}
        budgetsCount={Number(source.budgets) || 0}
        hasCutOff={hasCutOff}
        cutOffDue={cutOffDue}
        cutOffToday={cutOffToday}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}

/** Header block with Title, metadata tags, Involved Avatars, and Actions */
function SourceOverviewHeader({
  source,
  hasCutOff = false,
  cutOffDue = false,
  cutOffToday = false,
  isRefreshing,
  onBack,
  onRefresh,
  onPreview,
}) {
  return (
    <PageHeader
      title={
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <BackButton onClick={onBack} />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-2xl font-medium tracking-tight text-[var(--ink)]">
              {source.label || "Untitled source"}
            </span>
            <span
              className="mt-0.5 block truncate text-sm text-[var(--ink-muted)]"
              title={source.notes || undefined}
            >
              {source.notes || "Source of funds overview"}
            </span>
          </div>
        </div>
      }
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs pt-4">
          <span
            title={`Created on ${formatDate(source.created_at)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-2.5 font-semibold tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--border)]"
          >
            <CalendarDays
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--ink-muted)]"
            />
            Created {formatDate(source.created_at)}
          </span>
          {hasCutOff && source.date_cut_off && (
            <span
              title={
                cutOffDue
                  ? `Cut-off date already due — this source accepts no new activity since ${formatDate(source.date_cut_off)}`
                  : cutOffToday
                    ? `Today is the due date — this source stops accepting activity after today`
                    : `This source stops accepting activity on ${formatDate(source.date_cut_off)}`
              }
              className={
                cutOffDue
                  ? "inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)]/12 px-2.5 py-2 font-semibold tabular-nums text-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]/30"
                  : "inline-flex items-center gap-1.5 rounded-full bg-[var(--warning)]/12 px-2.5 py-2 font-semibold tabular-nums text-[var(--warning)] ring-1 ring-inset ring-[var(--warning)]/30"
              }
            >
              <CalendarX2 size={13} aria-hidden className="shrink-0" />
              {cutOffDue
                ? `Cut off due ${formatDate(source.date_cut_off)}`
                : cutOffToday
                  ? `Due today · ${formatDate(source.date_cut_off)}`
                  : `Cut off ${formatDate(source.date_cut_off)}`}
            </span>
          )}
        </span>
      }
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto ">
          <InvolvedStack
            people={source.involved}
            total={source.involved_count}
          />
          <StatusBadge status={source.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh ledger and source statistics"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <HeaderMenu onPreview={onPreview} />
        </div>
      }
    />
  );
}

/** Executive Stat Cards Grid with staggered entry animations */
function SourceStatCards({
  allocated,
  remaining,
  issued,
  spentTotal,
  isClosed,
  transactionCount,
  involvedCount,
  budgetsCount,
  isOverBudget,
  remainingPct,
  issuedPct,
}) {
  const cards = [
    {
      label: "Allocated Budget",
      value: formatMoney(allocated),
      icon: TrendingUp,
      accent: true,
      subtext: `${budgetsCount} top-up allocations`,
    },
    {
      // Closed sources have nothing "available" anymore — the leftover pool
      // balance reads as the balance forwarded (carried forward) instead.
      // Same figure, closed-state vocabulary — matching the reimbursement
      // pages' "Balance Forwarded" (hint: Remaining).
      label: isClosed ? "Balance Forwarded" : "Remaining Available",
      value: formatMoney(remaining),
      icon: PhilippinePeso,
      accent: false,
      subtext: isOverBudget
        ? "Deficit / Overdrawn"
        : `${remainingPct.toFixed(1)}% of pool unspent`,
    },
    {
      label: "Issued to Staff",
      value: formatMoney(issued),
      icon: HandCoins,
      accent: false,
      subtext: `${issuedPct.toFixed(1)}% disbursed`,
    },
    {
      label: "Total Liquidated",
      value: formatMoney(spentTotal),
      icon: ReceiptText,
      accent: false,
      subtext: "Direct + Field liquidations",
    },
    {
      label: "Transactions",
      value: Number(transactionCount),
      icon: ClipboardList,
      accent: false,
      subtext: `${involvedCount} connected parties`,
    },
  ];

  return (
    <motion.div
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.05, delayChildren: 0.02 },
        },
      }}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={{
            hidden: { opacity: 0, y: 12 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            subtext={card.subtext}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Budget Utilization, Multi-Segment Progressbar & Activity Chart
 */
function SourceUtilizationCard({
  allocated,
  balancedUsed,
  usedPct,
  isOverBudget,
  healthMeta,
  issued,
  issuedPct,
  directExpenses,
  directExpensesPct,
  remaining,
  remainingPct,
  forwarded,
  clampedUsedPct,
  issuedSegPct,
  expensesSegPct,
  employeeExpenses,
  settledAbono,
  chartMode,
  onChartModeChange,
  activityData,
  isTransactionsLoading,
}) {
  return (
    <Card
      padding="lg"
      className="relative overflow-hidden rounded-3xl shadow-card"
    >
      {/* Utilization Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-lg">
              Budget Utilization & Trajectory
            </CardTitle>
            <Badge tone={healthMeta.tone} className="text-xs">
              {healthMeta.label}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            {formatMoney(balancedUsed)} of {formatMoney(allocated)} drawn down (
            {usedPct.toFixed(1)}% net utilization)
          </CardDescription>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left sm:text-right">
            <span
              className={cn(
                "font-display text-2xl font-bold tabular-nums",
                isOverBudget ? "text-[var(--danger)]" : "text-[var(--ink)]",
              )}
            >
              {usedPct.toFixed(1)}%
            </span>
            <p className="text-[11px] text-[var(--ink-muted)]">Net Drawdown</p>
          </div>

          {/* Chart Mode Toggle */}
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChartModeChange("cumulative")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-medium transition-all",
                chartMode === "cumulative"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              Cumulative
            </button>
            <button
              type="button"
              onClick={() => onChartModeChange("balance")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-medium transition-all",
                chartMode === "balance"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              Balance Curve
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Segment Progress Bar */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedUsedPct)}
        aria-valuetext={`Issued ${issuedSegPct.toFixed(1)}% · Direct expenses ${expensesSegPct.toFixed(1)}% · Remaining ${remainingPct.toFixed(1)}%`}
        aria-label="Budget utilization progress"
        className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
      >
        {/* Issued Segment */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${issuedSegPct}%` }}
          transition={{
            duration: 0.85,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.1,
          }}
          className="absolute left-0 top-0 h-full bg-[var(--accent)]"
          title={`Issued to Staff: ${issuedSegPct.toFixed(1)}%`}
        />

        {/* Direct Expenses Segment */}
        <motion.div
          initial={{ width: 0, left: 0 }}
          animate={{ width: `${expensesSegPct}%`, left: `${issuedSegPct}%` }}
          transition={{
            duration: 0.85,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.2,
          }}
          className="absolute top-0 h-full bg-[var(--warning)] opacity-90"
          title={`Direct Expenses: ${expensesSegPct.toFixed(1)}%`}
        />

        {/* Over-budget Deficit Indicator */}
        {isOverBudget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="absolute right-0 top-0 h-full w-2 bg-[var(--danger)]"
            title="Budget exceeded"
          />
        )}
      </div>

      {/* Progress Bar Visual Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-y-2 border-b border-[var(--border)] pb-3 text-xs text-[var(--ink-muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <span>
              Issued to Staff:{" "}
              <strong className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(issued)} ({issuedPct.toFixed(1)}%)
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
            <span>
              Direct Expenses:{" "}
              <strong className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(directExpenses)} ({directExpensesPct.toFixed(1)}%)
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--border)] ring-1 ring-[var(--ink-muted)]/30" />
            <span>
              Available Pool:{" "}
              <strong className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(remaining)} ({remainingPct.toFixed(1)}%)
              </strong>
            </span>
          </div>
        </div>

        {forwarded > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] text-[var(--accent-strong)]">
            <span>
              + {formatMoney(forwarded)} re-credited from finalized holdings
            </span>
          </div>
        )}
      </div>

      {/* Activity & Trajectory Chart */}
      <div className="mt-4">
        <SourceActivityChart
          data={activityData}
          mode={chartMode}
          loading={isTransactionsLoading}
        />
      </div>

      {/* Financial Sub-Composition Breakdown (Non-Redundant) */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 transition-colors hover:bg-[var(--surface-2)]/70">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            Admin Direct Spend
          </p>
          <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(directExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            Direct vendor / office payouts
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 transition-colors hover:bg-[var(--surface-2)]/70">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            Staff Field Liquidations
          </p>
          <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(employeeExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            Liquidated receipts by staff
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 transition-colors hover:bg-[var(--surface-2)]/70">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            Settled Abono
          </p>
          <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(settledAbono)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            Reimbursed out-of-pocket
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 transition-colors hover:bg-[var(--surface-2)]/70">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            Returned Handover
          </p>
          <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--accent-strong)]">
            +{formatMoney(forwarded)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            Leftover from closed holdings
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Related Transactions Ledger Section
 * Contains filters, type tabs, and the read-only TransactionLedger table
 */
function SourceLedgerSection({
  tab,
  onTabChange,
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  direction,
  onDirectionChange,
  employee,
  onEmployeeChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  employeeOptions,
  categoryOptions,
  statusOptions,
  filtersOpen,
  onFiltersOpenChange,
  mobileFilterChips,
  clearFilters,
  hasActiveFilters,
  hasDateRange,
  rangeLabel,
  isTransactionsLoading,
  transactionsError,
  onRetry,
  pageRows,
  filteredRows,
  currentPage,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  onAction,
  countLedgerMatches,
  draft,
  totalDateRows,
}) {
  const searchField = (
    <div className="flex w-full items-center gap-2">
      <SearchInput
        leftIcon={<Search size={16} />}
        placeholder="Search description, employee, amount…"
        aria-label="Search transactions"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="min-w-0 flex-1"
        rightSlot={
          search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          ) : null
        }
      />
      <DateRangePicker
        value={dateRange}
        onChange={onDateRangeChange}
        placeholder="All dates"
        align="end"
        compactOnMobile
      />
    </div>
  );

  return (
    <Card
      padding="lg"
      radius="lg"
      className="relative overflow-visible shadow-card"
    >
      <CardHeader className="mb-4">
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="min-w-0">
            <CardTitle className="text-lg">Related Transactions</CardTitle>
            <CardDescription className="mt-1">
              <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                {hasDateRange ? (
                  <Badge tone="accent">
                    <CalendarRange size={12} aria-hidden />
                    {rangeLabel}
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    <CalendarOff size={12} aria-hidden />
                    All dates
                  </Badge>
                )}
                <span>
                  {hasDateRange
                    ? "· activity in this selected range"
                    : "· complete ledger activity for this source of funds"}
                </span>
              </span>
            </CardDescription>
          </div>
          <Badge tone="neutral" className="shrink-0 tabular-nums">
            {filteredRows.length}{" "}
            {filteredRows.length === 1 ? "record" : "records"}
          </Badge>
        </div>
      </CardHeader>

      {/* Type Tabs */}
      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="mb-4">
          <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto">
            {TYPE_TABS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="grow px-3 sm:grow-0 sm:px-4"
              >
                <Icon
                  size={13}
                  aria-hidden
                  className="hidden shrink-0 sm:block"
                />
                <span className="whitespace-nowrap text-xs font-medium">
                  {label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Filter Bar: Search, Date Range, Dropdowns */}
      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-start">
        {/* Mobile top row: Search + Date + Filter Sheet Trigger */}
        <div className="flex items-center gap-2 2xl:hidden">
          <div className="min-w-0 flex-1">{searchField}</div>
          <IconButton
            type="button"
            aria-label="Filter transactions"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => onFiltersOpenChange(true)}
            className={cn(
              "shrink-0 sm:h-10 sm:w-10",
              mobileFilterChips.length > 0 &&
                "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-strong)]",
            )}
          >
            <SlidersHorizontal size={16} aria-hidden />
            {mobileFilterChips.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-normal leading-none text-white ring-2 ring-[var(--surface)]">
                {mobileFilterChips.length}
              </span>
            )}
          </IconButton>
        </div>

        {/* Desktop full width filters */}
        <div
          role="group"
          aria-label="Transaction filters"
          className="hidden min-w-0 flex-1 grid-cols-4 gap-2 2xl:grid"
        >
          <Listbox
            portal
            options={TRANSACTION_DIRECTION_OPTIONS}
            value={direction}
            onChange={onDirectionChange}
            placeholder="All flows"
          />
          <Listbox
            portal
            searchable
            options={employeeOptions}
            value={employee}
            onChange={onEmployeeChange}
            placeholder="All employees"
          />
          <Listbox
            portal
            options={categoryOptions}
            value={category}
            onChange={onCategoryChange}
            placeholder="All categories"
          />
          <Listbox
            portal
            options={statusOptions}
            value={status}
            onChange={onStatusChange}
            placeholder="All statuses"
          />
        </div>

        {/* Mid screens (lg–2xl): 4 dropdown columns */}
        <div
          role="group"
          aria-label="Transaction filters"
          className="hidden min-w-0 grid-cols-2 gap-2 sm:grid-cols-2 lg:grid xl:grid-cols-4 2xl:hidden"
        >
          <Listbox
            portal
            options={TRANSACTION_DIRECTION_OPTIONS}
            value={direction}
            onChange={onDirectionChange}
            placeholder="All flows"
          />
          <Listbox
            portal
            searchable
            options={employeeOptions}
            value={employee}
            onChange={onEmployeeChange}
            placeholder="All employees"
          />
          <Listbox
            portal
            options={categoryOptions}
            value={category}
            onChange={onCategoryChange}
            placeholder="All categories"
          />
          <Listbox
            portal
            options={statusOptions}
            value={status}
            onChange={onStatusChange}
            placeholder="All statuses"
          />
        </div>

        {/* Desktop search + date picker slot */}
        <div className="hidden min-w-0 2xl:ml-auto 2xl:block 2xl:w-[420px] 2xl:shrink-0">
          {searchField}
        </div>
      </div>

      {/* Filter Chips */}
      <FilterChips chips={mobileFilterChips} onClearAll={clearFilters} />

      {/* Transaction Ledger Table (View Only) */}
      <TransactionLedger
        viewOnly
        isLoading={isTransactionsLoading}
        error={transactionsError}
        onRetry={onRetry}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        hasDateRange={hasDateRange}
        pageRows={pageRows}
        onAction={onAction}
        filteredRows={filteredRows}
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={onPageChange}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        rangeLabel={rangeLabel}
      />

      {/* Mobile Filter Sheet */}
      <FilterSheet
        open={filtersOpen}
        onClose={() => onFiltersOpenChange(false)}
        title="Filter transactions"
        description="Narrow this source's activity by type, money flow, employee and status."
        draftIsDefault={
          tab === "all" &&
          direction === "all" &&
          employee === "all" &&
          category === "all" &&
          status === "all"
        }
        matchCount={countLedgerMatches(draft)}
        totalRows={totalDateRows}
        hasActiveFilters={hasActiveFilters}
        onReset={clearFilters}
        onPrimary={() => onFiltersOpenChange(false)}
      >
        <FilterSheetField label="Transaction type">
          <Listbox
            options={TRANSACTION_TYPE_OPTIONS}
            value={tab}
            onChange={onTabChange}
            placeholder="All types"
          />
        </FilterSheetField>

        <FilterSheetField label="Money flow">
          <Listbox
            options={TRANSACTION_DIRECTION_OPTIONS}
            value={direction}
            onChange={onDirectionChange}
            placeholder="All flows"
          />
        </FilterSheetField>

        <FilterSheetField label="Employee">
          <Listbox
            searchable
            options={employeeOptions}
            value={employee}
            onChange={onEmployeeChange}
            placeholder="All employees"
          />
        </FilterSheetField>

        <FilterSheetField label="Category">
          <Listbox
            options={categoryOptions}
            value={category}
            onChange={onCategoryChange}
            placeholder="All categories"
          />
        </FilterSheetField>

        <FilterSheetField label="Status">
          <Listbox
            options={statusOptions}
            value={status}
            onChange={onStatusChange}
            placeholder="All statuses"
          />
        </FilterSheetField>
      </FilterSheet>
    </Card>
  );
}

/** Tooltip for the source activity chart */
function SourceActivityTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="min-w-[210px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-hover backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2 text-[11px] text-[var(--ink-muted)]">
        <span>{point.fullDate}</span>
        <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-medium capitalize text-[var(--ink)]">
          {point.status || "completed"}
        </span>
      </div>

      <div className="mt-2">
        <p className="truncate text-xs font-semibold text-[var(--ink)]">
          {point.title}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
          {point.kindLabel} ·{" "}
          <span className="font-medium text-[var(--ink)]">
            {point.signed}
            {formatMoney(point.amount)}
          </span>
        </p>
      </div>

      <div className="mt-2.5 space-y-1.5 border-t border-[var(--border)] pt-2 text-xs">
        {mode === "balance" ? (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              Remaining Pool
            </span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(point.balance)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Allocated Total
              </span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(point.cumAllocated)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
                Issued Total
              </span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(point.cumIssued)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                Liquidated Spent
              </span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(point.cumSpent)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] pt-1 text-[var(--ink)]">
              <span className="font-medium text-[var(--ink-muted)]">
                Pool Balance
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(point.balance)}
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** Animated AreaChart showing trajectory and balance curves */
export function SourceActivityChart({
  data,
  mode = "cumulative",
  loading,
  height = 200,
}) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold tracking-tight text-[var(--ink)]">
            {mode === "cumulative"
              ? "Trajectory Analysis"
              : "Pool Balance Curve"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {mode === "cumulative"
              ? "Running cumulative flow (Allocated vs. Issued vs. Liquidated)"
              : "Real-time remaining unspent pool balance over time"}
          </p>
        </div>

        {mode === "cumulative" ? (
          <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-[var(--accent)]"
              />
              Allocated
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-[var(--warning)]"
              />
              Issued
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-[var(--danger)]"
              />
              Spent
            </span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--accent-strong)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Remaining Pool Reserve
          </div>
        )}
      </div>

      {loading ? (
        <div
          className="animate-pulse rounded-2xl bg-[var(--surface-2)]"
          style={{ height }}
        />
      ) : data.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--ink-muted)]">
          <Activity size={24} className="mb-2 text-[var(--ink-muted)]/50" />
          <p className="font-medium text-[var(--ink)]">
            No activity recorded yet
          </p>
          <p className="mt-0.5">
            Transactions under this source will chart here automatically.
          </p>
        </div>
      ) : (
        <div className="px-1 sm:px-2">
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data}
              margin={{ top: 12, right: 12, bottom: 0, left: -8 }}
            >
              <defs>
                <linearGradient id="srcAllocated" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
                <linearGradient id="srcIssued" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--warning)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--warning)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
                <linearGradient id="srcSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--danger)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--danger)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
                <linearGradient id="srcBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent-strong)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent-strong)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 100) / 10}k` : v
                }
              />

              <Tooltip
                content={<SourceActivityTooltip mode={mode} />}
                cursor={{
                  stroke: "var(--accent)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />

              {mode === "balance" ? (
                <>
                  <ReferenceLine
                    y={0}
                    stroke="var(--border)"
                    strokeDasharray="2 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Remaining Balance"
                    stroke="var(--accent-strong)"
                    strokeWidth={2.5}
                    fill="url(#srcBalance)"
                    isAnimationActive={true}
                    animationDuration={850}
                    animationEasing="ease-out"
                    dot={{ r: 3, fill: "var(--accent-strong)", strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: "var(--accent-strong)",
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="cumAllocated"
                    name="Allocated"
                    stroke="var(--accent)"
                    strokeWidth={2.2}
                    fill="url(#srcAllocated)"
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-out"
                    dot={{ r: 2.5, fill: "var(--accent)", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "var(--accent)",
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumIssued"
                    name="Issued"
                    stroke="var(--warning)"
                    strokeWidth={2.2}
                    fill="url(#srcIssued)"
                    isAnimationActive={true}
                    animationDuration={900}
                    animationEasing="ease-out"
                    dot={{ r: 2.5, fill: "var(--warning)", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "var(--warning)",
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumSpent"
                    name="Spent"
                    stroke="var(--danger)"
                    strokeWidth={2.2}
                    fill="url(#srcSpent)"
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                    dot={{ r: 2.5, fill: "var(--danger)", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "var(--danger)",
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

/** Mirror loading skeleton */
function SourceOverviewSkeleton({ onBack }) {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-label="Loading source overview"
    >
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div aria-hidden className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-52 max-w-full animate-pulse rounded-lg bg-[var(--border)]" />
          <div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div
          aria-hidden
          className="hidden h-8 w-24 shrink-0 animate-pulse rounded-full bg-[var(--border)] sm:block"
        />
      </div>
      <div
        aria-hidden
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5"
      >
        <StatCard label="" value={0} icon={TrendingUp} accent loading />
        <StatCard label="" value={0} icon={Wallet} loading />
        <StatCard label="" value={0} icon={HandCoins} loading />
        <StatCard label="" value={0} icon={ReceiptText} loading />
        <StatCard label="" value={0} icon={ClipboardList} loading />
      </div>
      <Card padding="lg" className="relative overflow-hidden rounded-3xl">
        <div aria-hidden className="flex items-center justify-between gap-3">
          <div className="h-5 w-36 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div
          aria-hidden
          className="mt-3.5 h-3.5 animate-pulse overflow-hidden rounded-full bg-[var(--surface-2)]"
        />
        <div className="mt-4 h-44 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
      </Card>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to sources"
      title="Back to sources"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
    >
      <ArrowLeft size={16} aria-hidden />
    </button>
  );
}

// Compact actions menu for the overview header — a single item today (the
// read-only budget source preview), kept as an ellipsis dropdown so future
// actions land here without growing the header's button row.
function HeaderMenu({ onPreview }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const dismiss = () => {
      setOpen(false);
      setPosition(null);
    };
    const dismissWithFocus = () => {
      setOpen(false);
      setPosition(null);
      btnRef.current?.focus();
    };

    const handlePointerDown = (e) => {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        dismiss();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismissWithFocus();
      } else if (e.key === "Tab") {
        dismiss();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", dismiss, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", dismiss);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 6;
      const right = Math.max(8, window.innerWidth - rect.right);
      setPosition({
        top: Math.min(rect.bottom + margin, window.innerHeight - 150),
        right,
      });
    }
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setPosition(null);
  };

  return (
    <>
      <Button
        ref={btnRef}
        variant="outline"
        size="iconSm"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Source actions"
        className="shrink-0"
      >
        <EllipsisVertical size={14} aria-hidden />
      </Button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Source actions"
            style={position}
            className="fixed z-[70] w-[16rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-hover animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onPreview();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)]">
                <Eye size={14} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[var(--ink)]">
                  Preview Budget Source
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--ink-muted)]">
                  Balances, people and transactions.
                </span>
              </span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

export default AdminSourceFundsOverview;
