import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarOff,
  CalendarRange,
  Check,
  ClipboardList,
  Copy,
  EllipsisVertical,
  HandCoins,
  Inbox,
  Info,
  Plus,
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
} from "recharts";
import toast from "react-hot-toast";

import { PageHeader } from "../../../ui/PageHeader";
import { Button } from "../../../ui/Button";
import { StatCard } from "../../../ui/StatCard";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { EmptyState } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
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
import {
  useTransactions,
  useTransactionsMutations,
} from "../../../../hooks/useTransactions";
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
} from "@/constants";
import { matchesFilters, shortRangeLabel } from "@/lib/transactionLedger";
import { InvolvedStack, StatusBadge } from "./SourceBadges";
import { TransactionLedger } from "../transactions/TransactionLedger";
import TransactionDetailsModal from "../transactions/TransactionDetailsModal";
import ConfirmActionDialog from "../expenses/ConfirmActionDialog";
import {
  ACTION_ERROR,
  CONFIRM_COPY,
} from "../transactions/TransactionDialogCopy";

const PAGE_SIZE = 50;

export const TYPE_TABS = [
  { value: "all", label: "All", Icon: ClipboardList },
  { value: "budget", label: "Budget Given", Icon: Plus },
  { value: "issued", label: "Budget Issued", Icon: HandCoins },
  { value: "expense", label: "Expenses", Icon: ReceiptText },
  { value: "abono", label: "Abono", Icon: Wallet },
  { value: "transfer", label: "Transfers", Icon: ArrowLeftRight },
];

export function AdminSourceFundsOverview() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referenceId =
    location.state?.referenceId ??
    searchParams.get("ref") ??
    searchParams.get("referenceId") ??
    null;

  // Source of Funds data
  const {
    sources,
    isLoading: isSourceLoading,
    refetch: refetchSources,
  } = useSourceFunds();

  const source = useMemo(
    () =>
      (sources ?? []).find(
        (s) =>
          String(s.reference_id) === String(referenceId) ||
          (referenceId &&
            String(s.reference_id) === String(referenceId).trim()),
      ) ?? null,
    [sources, referenceId],
  );

  // Transactions data & mutations
  const {
    transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions();
  const mutations = useTransactionsMutations();

  // Filter & UI States for Related Transactions
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
  const [copiedId, setCopiedId] = useState(false);

  // Details Modal and Confirm Action state
  const [viewRow, setViewRow] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const rangeLabel = shortRangeLabel(dateRange);

  // Filter transactions exclusively attached to this source of funds
  const sourceRows = useMemo(() => {
    if (!source && !referenceId) return [];
    const targetRefId = String(source?.reference_id ?? referenceId ?? "");
    const targetLabel = source?.label?.toLowerCase().trim();

    return (transactions ?? []).filter((row) => {
      if (row.referenceId && String(row.referenceId) === targetRefId) {
        return true;
      }
      if (
        targetLabel &&
        row.referenceLabel?.toLowerCase().trim() === targetLabel
      ) {
        return true;
      }
      return false;
    });
  }, [transactions, source, referenceId]);

  // Dynamic filter dropdown options built from sourceRows
  const employeeOptions = useMemo(() => {
    const seen = new Map();
    let hasSystem = false;
    for (const row of sourceRows) {
      if (!row.employeeId) {
        if (row.kind === "budget") hasSystem = true;
        continue;
      }
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

  // Draft filter config for ledger helper
  const draft = useMemo(
    () => ({
      type: tab,
      direction,
      employee,
      reference: "all", // already scoped to this source
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

  // Full filtering with text search
  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return dateFilteredRows.filter((row) => matchesFilters(row, draft, query));
  }, [dateFilteredRows, draft, debouncedSearch]);

  // Counts per transaction type in active date range
  const kindCounts = useMemo(() => {
    const counts = { all: dateFilteredRows.length, transfer: 0 };
    for (const row of dateFilteredRows) {
      counts[row.kind] = (counts[row.kind] ?? 0) + 1;
      if (row.kind === "transfer_sent" || row.kind === "transfer_received") {
        counts.transfer = (counts.transfer ?? 0) + 1;
      }
    }
    return counts;
  }, [dateFilteredRows]);

  // Running cumulative totals from this source's transactions (oldest to
  // newest) for the activity chart below the utilization bar. Legs mirror
  // the stat cards: budget legs fund Allocated, issued legs fund Issued,
  // expense legs fund Spent (moneyIn/moneyOut are already 0 for void rows,
  // so cancelled lines never move the lines).
  const activityData = useMemo(() => {
    const short = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
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
    let cumAllocated = 0;
    let cumIssued = 0;
    let cumSpent = 0;
    return sorted.map((row) => {
      if (row.kind === "budget")
        cumAllocated = round(cumAllocated + (Number(row.moneyIn) || 0));
      else if (row.kind === "issued")
        cumIssued = round(cumIssued + (Number(row.moneyOut) || 0));
      else if (row.kind === "expense")
        cumSpent = round(cumSpent + (Number(row.moneyOut) || 0));
      // Settled abono is consumed spend (re-booked as an issued child), so it
      // joins the Spent line — this keeps the chart's final Spent total in
      // agreement with the Liquidated Spent card (admin + employee + settled).
      // moneyOut is already 0 for open/draft abono, so only settled legs move
      // the line.
      else if (row.kind === "abono")
        cumSpent = round(cumSpent + (Number(row.moneyOut) || 0));
      return {
        label: short(row.date),
        fullDate: full(row.date),
        title: row.description || "",
        status: row.status || "",
        amount: Number(row.amount) || 0,
        signed: row.direction === "in" ? "+" : row.direction === "out" ? "−" : "",
        cumAllocated,
        cumIssued,
        cumSpent,
        balance: round(cumAllocated - cumIssued - cumSpent),
        kindLabel:
          TRANSACTION_KIND_META[row.kind]?.label ?? row.kind ?? "record",
      };
    });
  }, [sourceRows]);

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

  // Active filters check & clear
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

  const filterLabels = {
    direction: TRANSACTION_DIRECTION_OPTIONS.find((o) => o.value === direction)
      ?.label,
    employee: employeeOptions.find((o) => o.value === employee)?.label,
    category: categoryOptions.find((o) => o.value === category)?.label,
    status: statusOptions.find((o) => o.value === status)?.label,
  };

  const mobileFilterChips = useMemo(() => {
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
  }, [tab, direction, employee, category, status, filterLabels]);

  // Row mutation actions
  const confirmPending =
    mutations.cancelBudget.isPending ||
    mutations.restoreBudget.isPending ||
    mutations.removeBudget.isPending ||
    mutations.cancelIssued.isPending ||
    mutations.restoreIssued.isPending ||
    mutations.removeIssued.isPending ||
    mutations.removeExpense.isPending ||
    mutations.markExpenseDraft.isPending ||
    mutations.markExpensePaid.isPending ||
    mutations.cancelExpense.isPending ||
    mutations.removeAbono.isPending ||
    mutations.cancelTransfer.isPending;

  const handleAction = async (action, row) => {
    if (action === "view") {
      setViewRow(row);
      setViewOpen(true);
      return;
    }
    if (action === "restore-budget") {
      try {
        await mutations.restoreBudget.mutateAsync({
          id: row.id,
          status: "added",
        });
        toast.success("Transaction restored");
      } catch (err) {
        toast.error(err?.message || ACTION_ERROR["restore-budget"]);
      }
      return;
    }
    if (action === "restore-issued") {
      try {
        await mutations.restoreIssued.mutateAsync({
          id: row.id,
          status: "open",
        });
        toast.success("Issuance restored");
      } catch (err) {
        toast.error(err?.message || ACTION_ERROR["restore-issued"]);
      }
      return;
    }
    setConfirmAction({ row, action });
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (!confirmPending) setConfirmOpen(false);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const { action, row } = confirmAction;
    try {
      if (action === "cancel-budget") {
        await mutations.cancelBudget.mutateAsync(row.id);
        toast.success("Budget transaction cancelled");
      } else if (action === "cancel-issued") {
        await mutations.cancelIssued.mutateAsync(row.id);
        toast.success("Budget issuance cancelled");
      } else if (action === "delete-expense") {
        await mutations.removeExpense.mutateAsync(row.id);
        toast.success("Expense deleted");
      } else if (action === "delete-budget") {
        await mutations.removeBudget.mutateAsync(row.id);
        toast.success("Budget record deleted");
      } else if (action === "delete-issued") {
        await mutations.removeIssued.mutateAsync(row.id);
        toast.success("Issued record deleted");
      } else if (action === "expense-draft") {
        await mutations.markExpenseDraft.mutateAsync(row.id);
        toast.success("Expense moved to draft");
      } else if (action === "expense-restore") {
        await mutations.markExpensePaid.mutateAsync(row.id);
        toast.success("Expense marked as paid");
      } else if (action === "expense-cancel") {
        await mutations.cancelExpense.mutateAsync({
          id: row.id,
          status: "cancel",
        });
        toast.success("Expense cancelled");
      } else if (action === "delete-abono") {
        await mutations.removeAbono.mutateAsync(row.id);
        toast.success("Abono deleted");
      } else if (action === "cancel-transfer") {
        await mutations.cancelTransfer.mutateAsync(row.id);
        toast.success("Transfer cancelled");
      }
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || ACTION_ERROR[action] || "Couldn't proceed");
    }
  };

  const confirmCopy =
    CONFIRM_COPY[confirmAction?.action] ?? CONFIRM_COPY["delete-expense"];
  const confirmSummary = confirmAction ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {confirmAction.row.description || "Untitled transaction"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {TRANSACTION_KIND_META[confirmAction.row.kind]?.label ?? ""} ·{" "}
          {formatDate(confirmAction.row.date)}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(confirmAction.row.amount)}
      </span>
    </div>
  ) : null;

  const backToList = () => nav("/admin/source-funds");

  const copyRefId = () => {
    if (!source?.reference_id) return;
    navigator.clipboard.writeText(source.reference_id);
    setCopiedId(true);
    toast.success("Reference ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyPageUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Overview link copied to clipboard");
  };

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

  // Loading Mirror Skeleton
  if (isSourceLoading) {
    return (
      <div
        className="space-y-5"
        role="status"
        aria-label="Loading source overview"
      >
        <div className="flex items-center gap-3">
          <BackButton onClick={backToList} />
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
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4"
        >
          <StatCard label="" value={0} icon={TrendingUp} accent loading />
          <StatCard label="" value={0} icon={Wallet} loading />
          <StatCard label="" value={0} icon={HandCoins} loading />
          <StatCard label="" value={0} icon={ReceiptText} loading />
        </div>
        <Card padding="lg" className="relative overflow-hidden rounded-3xl">
          <div aria-hidden className="flex items-center justify-between gap-3">
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
          </div>
          <div
            aria-hidden
            className="mt-3 h-2.5 animate-pulse overflow-hidden rounded-full bg-[var(--surface-2)]"
          />
          <div aria-hidden className="mt-3 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border)] px-2 py-3"
              >
                <div className="mx-auto h-3 w-14 animate-pulse rounded bg-[var(--border)]" />
                <div className="mx-auto mt-2 h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
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

  // Financial calculations
  const allocated = Number(source.allocated) || 0;
  const issued = Number(source.issued) || 0;
  const expenses = Number(source.expenses) || 0;
  // Total spent for display: admin + employee + settled legs — the same
  // figure the SourceTable Spent column shows.
  const spentTotal = toMoney(
    Number(source.expenses) +
      Number(source.employeeExpenses) +
      Number(source.settledAbono),
  );
  const remaining = toMoney(
    source.remaining ?? Math.max(0, allocated - (issued + expenses)),
  );

  const issuedPct =
    allocated > 0 ? Math.min(100, Math.max(0, (issued / allocated) * 100)) : 0;
  // Stat-card subtext (all-legs total liquidation — matches the Direct
  // Expenses card value, not the bar segment).
  const expensesPct =
    allocated > 0
      ? Math.min(100 - issuedPct, Math.max(0, (spentTotal / allocated) * 100))
      : 0;
  // Balanced utilization, derived from the BACKEND `remaining` figure
  // (remaining = allocated − issued − admin + forwarded) so the headline %
  // always agrees with the Remaining card: (allocated − remaining)/allocated.
  // Summing frontend legs instead drifts whenever finalized holdings hand
  // leftover back (forwarded), overstating utilization past the true balance.
  const balancedUsed = toMoney(allocated - remaining);
  const remainingPct =
    allocated > 0
      ? Math.max(0, Math.min(100, (remaining / allocated) * 100))
      : 0;
  const usedPct = allocated > 0 ? Math.max(0, 100 - remainingPct) : 0;
  // Direct Expenses marker position (all legs — the stat-card figure). Drawn
  // as a tick line, NOT a stacked segment, so it never double-counts issued
  // money into a fake 100% fill.
  const spentMarkerPct =
    allocated > 0
      ? Math.min(100, Math.max(0, (spentTotal / allocated) * 100))
      : 0;
  // Stacked segments fill exactly to usedPct: issued first (capped), then
  // the balanced remainder. With no handed-back leftovers the remainder
  // equals the admin share exactly.
  const issuedSegPct = Math.min(issuedPct, usedPct);
  const expensesSegPct = Math.max(0, usedPct - issuedSegPct);

  const involved = Array.isArray(source.involved) ? source.involved : [];

  const healthMeta =
    usedPct >= 100
      ? {
          tone: "danger",
          label: "Budget Exhausted",
          desc: "100% of allocated pool utilized",
        }
      : usedPct >= 85
        ? {
            tone: "warning",
            label: "High Utilization",
            desc: "Approaching total allocation",
          }
        : usedPct >= 50
          ? {
              tone: "accent",
              label: "Moderate Utilization",
              desc: "Healthy drawdown pace",
            }
          : {
              tone: "success",
              label: "Optimal Reserves",
              desc: "Substantial funds available",
            };

  // Search & Date Picker Bar
  const searchField = (
    <div className="flex w-full items-center gap-2">
      <SearchInput
        leftIcon={<Search size={16} />}
        placeholder="Search description, employee, amount…"
        aria-label="Search transactions"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        className="min-w-0 flex-1"
        rightSlot={
          search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(0);
              }}
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
        onChange={(r) => {
          setDateRange(r);
          setPage(0);
        }}
        placeholder="All dates"
        align="end"
        compactOnMobile
      />
    </div>
  );

  return (
    <div className="space-y-6 pb-6">
      {/* ── Page Header ── */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <BackButton onClick={backToList} />
            <span className="truncate">
              {source.label || "Untitled source"}
            </span>
          </div>
        }
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
            <span>Created {formatDate(source.created_at)}</span>
            {source.date_cut_off && (
              <>
                <span aria-hidden>·</span>
                <span>Cut off {formatDate(source.date_cut_off)}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              ID: {source.reference_id?.slice(0, 12)}…
            </span>
          </div>
        }
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <InvolvedStack
              people={source.involved}
              total={source.involved_count}
              size="lg"
            />
            <StatusBadge status={source.status} />
            <HeaderMenu />
          </div>
        }
      />

      {/* ── Optional Notes Banner ── */}
      {source.notes && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
          <Info size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Source Purpose & Notes
            </p>
            <p className="mt-1 break-words text-sm leading-relaxed text-[var(--ink)]">
              {source.notes}
            </p>
          </div>
        </div>
      )}

      {/* ── Primary Financial Stat Cards ── */}
      <motion.div
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.06, delayChildren: 0.02 },
          },
        }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5"
      >
        {[
          {
            label: "Allocated Budget",
            value: formatMoney(allocated),
            icon: TrendingUp,
            accent: true,
            subtext: `${Number(source.budgets) || 0} top-up allocations`,
          },
          {
            label: "Remaining Available",
            value: formatMoney(remaining),
            icon: Wallet,
            accent: false,
            subtext: `${remainingPct.toFixed(1)}% of pool unspent`,
          },
          {
            label: "Issued to Staff",
            value: formatMoney(issued),
            icon: HandCoins,
            accent: false,
            subtext: `${issuedPct.toFixed(1)}% disbursed`,
          },
          {
            label: "Direct Expenses",
            value: formatMoney(spentTotal),
            icon: ReceiptText,
            accent: false,
            subtext: `${expensesPct.toFixed(1)}% liquidated`,
          },
          {
            label: "Transactions",
            value: Number(sourceRows.length || source.transactions || 0),
            icon: ClipboardList,
            accent: false,
            subtext: `${involved.length} connected parties`,
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
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

      {/* ── Budget Utilization & Distribution Breakdown ── */}
      <Card
        padding="lg"
        className="relative overflow-hidden rounded-3xl shadow-card"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-lg">
                Budget Utilization & Breakdown
              </CardTitle>
              <Badge tone={healthMeta.tone} className="text-xs">
                {healthMeta.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {formatMoney(balancedUsed)} of {formatMoney(allocated)} accounted
              for ({usedPct.toFixed(1)}% utilized)
            </CardDescription>
          </div>
          <div className="text-left sm:text-right">
            <span className="font-display text-2xl font-bold tabular-nums text-[var(--ink)]">
              {usedPct.toFixed(1)}%
            </span>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Total Utilization
            </p>
          </div>
        </div>

        {/* Multi-segment Segmented Progress Bar */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedPct)}
          aria-valuetext={`Issued ${issuedSegPct.toFixed(1)}% · Direct expenses ${spentMarkerPct.toFixed(1)}% · Remaining ${remainingPct.toFixed(1)}%`}
          aria-label="Budget utilization progress"
          className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
        >
          {/* Issued Segment */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${issuedSegPct}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="absolute left-0 top-0 h-full bg-[var(--accent)]"
            title={`Issued: ${issuedSegPct.toFixed(1)}%`}
          />
          {/* Expenses Segment (balanced remainder — fills exactly to utilized) */}
          <motion.div
            initial={{ width: 0, left: 0 }}
            animate={{ width: `${expensesSegPct}%`, left: `${issuedSegPct}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="absolute top-0 h-full bg-[var(--warning)] opacity-90"
            title={`Direct Expenses: ${expensesSegPct.toFixed(1)}%`}
          />
          {/* Direct Expenses marker (all legs — the stat-card figure) */}
          {spentTotal > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, left: `${spentMarkerPct}%` }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.3,
              }}
              title={`Direct Expenses (all legs): ${formatMoney(spentTotal)} (${spentMarkerPct.toFixed(1)}% of pool)`}
              className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            />
          )}
        </div>

        {/* Source activity chart — running Allocated / Issued / Spent totals
            from this source's transactions (replaces the static legend) */}
        <div className="mt-4">
          <SourceActivityChart
            data={activityData}
            loading={isTransactionsLoading}
          />
        </div>

        {/* 4 Mini Cards Distribution Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-center sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
              Total Injected
            </p>
            <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(allocated)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {Number(source.budgets) || 0} top-up allocations
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-center sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
              Issued Out
            </p>
            <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(issued)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {issuedSegPct.toFixed(1)}% of total pool
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-center sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
              Liquidated Spent
            </p>
            <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--ink)]">
              {formatMoney(spentTotal)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {spentMarkerPct.toFixed(1)}% of total pool
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-center sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
              Available Reserve
            </p>
            <p className="mt-1 truncate font-display text-base font-semibold tabular-nums text-[var(--success)]">
              {formatMoney(remaining)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
              {remainingPct.toFixed(1)}% uncommitted
            </p>
          </div>
        </div>
      </Card>

      {/* ── Related Transactions Ledger Section ── */}
      <Card
        padding="lg"
        radius="lg"
        className="relative overflow-visible shadow-card"
      >
        <CardHeader className="mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Related Transactions</CardTitle>
              <Badge tone="neutral" className="tabular-nums">
                {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "record" : "records"}
              </Badge>
            </div>
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
        </CardHeader>

        {/* ── Filter Controls ── */}
        {/* 1. Type Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setPage(0);
          }}
        >
          <div className="mb-4">
            <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto">
              {TYPE_TABS.map(({ value, label, Icon }) => {
                const count =
                  value === "all"
                    ? kindCounts.all
                    : value === "transfer"
                      ? kindCounts.transfer
                      : (kindCounts[value] ?? 0);
                return (
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
                    <span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.2 text-[10px] font-medium tabular-nums text-[var(--ink-muted)]">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Tabs>

        {/* 2. Filter Bar: Search, Date Range, Dropdowns */}
        <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-start">
          {/* Mobile top row: Search + Date + Filter Sheet Trigger */}
          <div className="flex items-center gap-2 2xl:hidden">
            <div className="min-w-0 flex-1">{searchField}</div>
            <IconButton
              type="button"
              aria-label="Filter transactions"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(true)}
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
              onChange={(v) => {
                setDirection(v);
                setPage(0);
              }}
              placeholder="All flows"
            />
            <Listbox
              portal
              searchable
              options={employeeOptions}
              value={employee}
              onChange={(v) => {
                setEmployee(v);
                setPage(0);
              }}
              placeholder="All employees"
            />
            <Listbox
              portal
              options={categoryOptions}
              value={category}
              onChange={(v) => {
                setCategory(v);
                setPage(0);
              }}
              placeholder="All categories"
            />
            <Listbox
              portal
              options={statusOptions}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
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
              onChange={(v) => {
                setDirection(v);
                setPage(0);
              }}
              placeholder="All flows"
            />
            <Listbox
              portal
              searchable
              options={employeeOptions}
              value={employee}
              onChange={(v) => {
                setEmployee(v);
                setPage(0);
              }}
              placeholder="All employees"
            />
            <Listbox
              portal
              options={categoryOptions}
              value={category}
              onChange={(v) => {
                setCategory(v);
                setPage(0);
              }}
              placeholder="All categories"
            />
            <Listbox
              portal
              options={statusOptions}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              placeholder="All statuses"
            />
          </div>

          {/* Desktop search + date picker slot */}
          <div className="hidden min-w-0 2xl:ml-auto 2xl:block 2xl:w-[420px] 2xl:shrink-0">
            {searchField}
          </div>
        </div>

        {/* 3. Filter Chips (visible on mobile / small screen when filters active) */}
        <FilterChips chips={mobileFilterChips} onClearAll={clearFilters} />

        {/* ── Transaction Ledger Table & Cards ── */}
        <TransactionLedger
          isLoading={isTransactionsLoading}
          error={transactionsError}
          onRetry={refetchTransactions}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          hasDateRange={hasDateRange}
          pageRows={pageRows}
          pending={confirmPending}
          onAction={handleAction}
          filteredRows={filteredRows}
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={setPage}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          rangeLabel={rangeLabel}
        />
      </Card>

      {/* ── Mobile Filter Bottom Sheet ── */}
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
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
        totalRows={dateFilteredRows.length}
        hasActiveFilters={hasActiveFilters}
        onReset={clearFilters}
        onPrimary={() => setFiltersOpen(false)}
      >
        <FilterSheetField label="Transaction type">
          <Listbox
            options={TRANSACTION_TYPE_OPTIONS}
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(0);
            }}
            placeholder="All types"
          />
        </FilterSheetField>

        <FilterSheetField label="Money flow">
          <Listbox
            options={TRANSACTION_DIRECTION_OPTIONS}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setPage(0);
            }}
            placeholder="All flows"
          />
        </FilterSheetField>

        <FilterSheetField label="Employee">
          <Listbox
            searchable
            options={employeeOptions}
            value={employee}
            onChange={(v) => {
              setEmployee(v);
              setPage(0);
            }}
            placeholder="All employees"
          />
        </FilterSheetField>

        <FilterSheetField label="Category">
          <Listbox
            options={categoryOptions}
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
            placeholder="All categories"
          />
        </FilterSheetField>

        <FilterSheetField label="Status">
          <Listbox
            options={statusOptions}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
            placeholder="All statuses"
          />
        </FilterSheetField>
      </FilterSheet>

      {/* ── Transaction Details Modal ── */}
      <TransactionDetailsModal
        open={viewOpen}
        row={viewRow}
        onClose={() => setViewOpen(false)}
      />

      {/* ── Confirm Action Dialog ── */}
      <ConfirmActionDialog
        open={confirmOpen}
        icon={confirmCopy.icon}
        iconClassName={confirmCopy.iconClassName}
        title={confirmCopy.title}
        description={confirmCopy.description}
        summary={confirmSummary}
        cancelLabel={confirmCopy.cancelLabel}
        confirmLabel={confirmCopy.confirmLabel}
        confirmVariant={confirmCopy.confirmVariant ?? "danger"}
        pendingLabel={confirmCopy.pendingLabel}
        pending={confirmPending}
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />

      {/* ── Footer Helpful Tip ── */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3 text-xs text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Tip: This overview is directly bookmarkable — URL carries{" "}
          <span className="font-mono text-[var(--ink)]">
            ?ref={source.reference_id}
          </span>
          .
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copyPageUrl}
            className="font-medium text-[var(--accent-strong)] hover:underline"
          >
            Copy shareable link
          </button>
          <span aria-hidden>·</span>
          <Link
            to="/admin/source-funds"
            className="font-medium text-[var(--accent-strong)] hover:underline"
          >
            Browse all sources
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Per-point tooltip for the source activity chart — date, triggering record
 * plus the three running totals and the derived balance. */
function SourceActivityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const lines = [
    {
      label: "Allocated total",
      value: point.cumAllocated,
      dot: "bg-[var(--accent)]",
    },
    {
      label: "Issued total",
      value: point.cumIssued,
      dot: "bg-[var(--warning)]",
    },
    {
      label: "Spent total",
      value: point.cumSpent,
      dot: "bg-[var(--danger)]",
    },
    {
      label: "Balance",
      value: point.balance,
      dot: "bg-[var(--success)]",
    },
  ];
  return (
    <div className="min-w-[190px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-hover">
      <p className="text-xs font-medium tabular-nums text-[var(--ink-muted)]">
        {point.fullDate}
      </p>
      <p className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--ink-muted)]">
          <span className="truncate">
            {point.kindLabel}
            {point.status ? ` · ${point.status}` : ""}
          </span>
        </span>
        <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
          {point.signed}
          {formatMoney(point.amount)}
        </span>
      </p>
      <div className="mt-1.5 space-y-1 border-t border-[var(--border)] pt-1.5">
        {lines.map((line) => (
          <p
            key={line.label}
            className="flex items-center justify-between gap-3 text-xs tabular-nums"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span aria-hidden className={`h-2 w-2 rounded-full ${line.dot}`} />
              {line.label}
            </span>
            <span className="font-medium text-[var(--ink)]">
              {formatMoney(line.value)}
            </span>
          </p>
        ))}
      </div>
      {point.title && (
        <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">
          {point.title}
        </p>
      )}
    </div>
  );
}

/** Source activity chart — running Allocated / Issued / Spent totals from
 * this source's transactions, same visual language as the employee balance
 * trace (EmployeeTraceChart). */
export function SourceActivityChart({ data, loading, height = 190 }) {
  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium tracking-tight text-[var(--ink)]">
            Source activity
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Running totals from this source&apos;s transactions — hover any
            point to compare.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-xs text-[var(--ink-muted)]">
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
      </div>
      {loading ? (
        <div
          className="animate-pulse rounded-2xl bg-[var(--surface-2)]"
          style={{ height }}
        />
      ) : data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
          No transactions to chart yet.
        </p>
      ) : (
        <div className="px-1 sm:px-2">
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 8, bottom: 0, left: -10 }}
            >
              <defs>
                <linearGradient id="srcAllocated" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="srcIssued" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--warning)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--warning)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="srcSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--danger)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--danger)"
                    stopOpacity={0}
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
                content={<SourceActivityTooltip />}
                cursor={{ stroke: "var(--border)" }}
              />
              <Area
                type="monotone"
                dataKey="cumAllocated"
                name="Allocated"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#srcAllocated)"
                dot={{ r: 3, fill: "var(--accent-strong)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--accent-strong)" }}
              />
              <Area
                type="monotone"
                dataKey="cumIssued"
                name="Issued"
                stroke="var(--warning)"
                strokeWidth={2.5}
                fill="url(#srcIssued)"
                dot={{ r: 3, fill: "var(--warning)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--warning)" }}
              />
              <Area
                type="monotone"
                dataKey="cumSpent"
                name="Spent"
                stroke="var(--danger)"
                strokeWidth={2.5}
                fill="url(#srcSpent)"
                dot={{ r: 3, fill: "var(--danger)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--danger)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
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

// Header overflow menu — labels only for now (no actions wired yet, so each
// item just dismisses the menu).
const HEADER_MENU_ITEMS = [
  { key: "reopen", label: "Reopen transactions" },
  { key: "print", label: "Print report transaction" },
];

function HeaderMenu() {
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
      )
        dismiss();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismissWithFocus();
      } else if (e.key === "Tab") {
        dismiss();
      }
    };

    const handleScroll = () => dismiss();
    const handleResize = () => dismiss();

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 6;
      const estimatedHeight = 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flip = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const right = Math.max(8, window.innerWidth - rect.right);
      if (flip) {
        setPosition({
          bottom: Math.max(margin, window.innerHeight - rect.top + margin),
          right,
        });
      } else {
        setPosition({
          top: Math.min(
            rect.bottom + margin,
            Math.max(margin, window.innerHeight - 120),
          ),
          right,
        });
      }
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
            className="fixed z-[70] min-w-[14rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {HEADER_MENU_ITEMS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={closeMenu}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
              >
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default AdminSourceFundsOverview;
