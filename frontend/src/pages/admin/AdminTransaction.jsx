import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Ban,
  CalendarOff,
  CalendarRange,
  CircleCheck,
  ClipboardList,
  HandCoins,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "../../components/ui/Badge";
import { IconButton } from "../../components/ui/IconButton";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { SearchInput } from "../../components/ui/Input";
import Listbox from "../../components/ui/Listbox";
import { FilterChips } from "../../components/ui/MobileFilters";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/DataState";
import { Pager } from "../../components/ui/Pager";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import {
  cn,
  emptyDateRange,
  formatDate,
  formatMoney,
  matchesDayRange,
  methodLabel,
  startOfDay,
  toDate,
} from "../../lib/utils";
import {
  useTransactions,
  useTransactionsMutations,
} from "../../hooks/useTransactions";
import TransactionsTable, {
  TRANSACTION_KIND_META,
} from "../../components/layout/admin/transactions/TransactionsTable";
import TransactionDetailsModal from "../../components/layout/admin/transactions/TransactionDetailsModal";
import TransactionsMobileFilters from "../../components/layout/admin/transactions/TransactionsMobileFilters";
import ConfirmActionDialog from "../../components/layout/admin/expenses/ConfirmActionDialog";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};
const PAGE_SIZE = 100;
const SYSTEM_EMPLOYEE_VALUE = "__system";
const DAY_MS = 86_400_000;
// Desktop filter order — rendered as a pure CSS grid (no JS measuring, no
// sliding track) so resizing never creates a transient horizontal scrollbar
// and the visible set of filters never shifts under the user's cursor.
const FILTER_KEYS = [
  "direction",
  "employee",
  "reference",
  "category",
  "status",
];
const TYPE_TABS = [
  { value: "all", label: "All", Icon: ClipboardList },
  { value: "budget", label: "Budget Given", Icon: Plus },
  { value: "issued", label: "Budget Issued", Icon: HandCoins },
  { value: "expense", label: "Expenses", Icon: ReceiptText },
  { value: "abono", label: "Abono", Icon: Wallet },
  { value: "transfer", label: "Transfers", Icon: ArrowLeftRight },
];
const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "budget", label: "Budget Given" },
  { value: "issued", label: "Budget Issued" },
  { value: "expense", label: "Expenses" },
  { value: "abono", label: "Abono" },
  { value: "transfer", label: "Transfers" },
];
const DIRECTION_OPTIONS = [
  { value: "all", label: "All flows" },
  { value: "in", label: "Money In" },
  { value: "out", label: "Money Out" },
  { value: "void", label: "No movement" },
];
const CONFIRM_COPY = {
  "cancel-budget": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this budget transaction?",
    description:
      "Status moves to Cancelled — the amount stops counting as Money In. You can restore it afterwards.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "cancel-issued": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this budget issuance?",
    description:
      "Status moves to Cancelled — the amount stops counting as Money Out. You can restore it afterwards.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "delete-expense": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this expense?",
    description:
      "Permanently removes the expense record and its receipt. This can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "delete-budget": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this budget record?",
    description:
      "Permanently removes the cancelled budget transaction. Only cancelled rows can be deleted — this can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "delete-issued": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this issued record?",
    description:
      "Permanently removes the cancelled issuance and its scanned receipt file. Refused when linked expenses exist — this can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "expense-draft": {
    icon: <RotateCcw size={20} aria-hidden />,
    title: "Move this expense to draft?",
    description:
      "Status moves back to Draft — only paid expenses count as Money Out.",
    cancelLabel: "Keep as paid",
    confirmLabel: "Yes, move to draft",
    pendingLabel: "Moving…",
  },
  "expense-restore": {
    icon: <CircleCheck size={20} aria-hidden />,
    iconClassName: "bg-[var(--success)]/12 text-[var(--success)]",
    title: "Mark this expense as paid?",
    description: "The record leaves Draft and counts as Money Out again.",
    cancelLabel: "Keep as draft",
    confirmLabel: "Yes, mark as paid",
    confirmVariant: "accent",
    pendingLabel: "Restoring…",
  },
  "expense-cancel": {
    icon: <XCircle size={20} aria-hidden />,
    title: "Cancel this expense?",
    description:
      "Status moves to Cancelled — it is void and never counts as Money Out.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "delete-abono": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this abono?",
    description:
      "Permanently removes the abono record. Refused when the amount has already been spent.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "cancel-transfer": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this transfer?",
    description:
      "Removes both legs of the transfer. Refused when the recipient has already spent the amount.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
};
const ACTION_ERROR = {
  "cancel-budget": "Couldn't cancel budget transaction",
  "restore-budget": "Couldn't restore budget transaction",
  "cancel-issued": "Couldn't cancel budget issuance",
  "restore-issued": "Couldn't restore budget issuance",
  "delete-expense": "Couldn't delete expense",
  "delete-budget": "Couldn't delete budget record",
  "delete-issued": "Couldn't delete issued record",
  "expense-draft": "Couldn't move expense to draft",
  "expense-restore": "Couldn't mark expense as paid",
  "expense-cancel": "Couldn't cancel expense",
  "delete-abono": "Couldn't delete abono",
  "cancel-transfer": "Couldn't cancel transfer",
};
const matchesTypeTab = (row, tab) => {
  if (tab === "all") return true;
  if (tab === "transfer")
    return row.kind === "transfer_sent" || row.kind === "transfer_received";
  return row.kind === tab;
};
const rowDay = (row) => toDate(row?.date);
const countDays = (start, end) =>
  Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;
const shortRangeLabel = (range) => {
  if (!range?.start || !range?.end) return "";
  const crossYear = range.start.getFullYear() !== range.end.getFullYear();
  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(crossYear ? { year: "numeric" } : {}),
    });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
};
const rowsWindow = (rows) => {
  let start = null;
  let end = null;
  for (const row of rows) {
    const day = rowDay(row);
    if (!day) continue;
    const mid = startOfDay(day);
    if (!start || mid < start) start = mid;
    if (!end || mid > end) end = mid;
  }
  return start && end ? { start, end } : null;
};
const buildRangeSeries = (range, rows, measure) => {
  const start = range?.start ? startOfDay(range.start) : null;
  const end = range?.end ? startOfDay(range.end) : null;
  if (!start || !end || end < start) return [];
  const days = countDays(start, end);
  const bucketDays = days <= 14 ? 1 : Math.ceil(days / 14);
  const totals = new Array(Math.ceil(days / bucketDays)).fill(0);
  for (const row of rows) {
    const day = rowDay(row);
    if (!day) continue;
    const mid = startOfDay(day);
    if (mid < start || mid > end) continue;
    totals[Math.floor((countDays(start, mid) - 1) / bucketDays)] +=
      measure(row);
  }
  return totals.map((v) => ({ v }));
};
const matchesFilters = (row, draft, query) => {
  if (!matchesTypeTab(row, draft.type)) return false;
  if (draft.direction !== "all" && row.direction !== draft.direction)
    return false;
  if (draft.employee !== "all") {
    if (draft.employee === SYSTEM_EMPLOYEE_VALUE) {
      if (row.employeeId) return false;
    } else if (row.employeeId !== draft.employee) return false;
  }
  if (draft.reference !== "all") {
    const val = row.referenceId ?? `label:${row.referenceLabel}`;
    if (val !== draft.reference) return false;
  }
  if (draft.category !== "all" && row.categoryId !== draft.category)
    return false;
  if (draft.status !== "all" && row.status !== draft.status) return false;
  if (!query) return true;
  return [
    row.description,
    row.notes,
    row.employeeName,
    row.counterpartyName,
    row.referenceLabel,
    row.categoryName,
    row.approvedBy,
    row.method ? methodLabel(row.method) : "",
    TRANSACTION_KIND_META[row.kind]?.label,
    row.direction === "in"
      ? "money in"
      : row.direction === "out"
        ? "money out"
        : "",
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(query));
};
const AdminTransaction = () => {
  const { data, isLoading, error, refetch } = useTransactions();
  const mutations = useTransactionsMutations();
  const [dateRange, setDateRange] = useState(() => emptyDateRange());
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [reference, setReference] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const allRows = useMemo(() => data?.transactions ?? [], [data]);
  const employeeOptions = useMemo(() => {
    const seen = new Map();
    let hasSystem = false;
    for (const row of allRows) {
      if (!row.employeeId) {
        if (row.kind === "budget") hasSystem = true;
        continue;
      }
      if (!seen.has(row.employeeId))
        seen.set(row.employeeId, {
          value: row.employeeId,
          label: row.employeeName || "Unknown",
          avatar: row.employeeAvatar || "",
        });
    }
    return [
      { value: "all", label: "All employees" },
      ...(hasSystem ? [{ value: SYSTEM_EMPLOYEE_VALUE, label: "Boss" }] : []),
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [allRows]);
  const referenceOptions = useMemo(() => {
    const seen = new Map();
    for (const row of allRows) {
      const val = row.referenceId ?? `label:${row.referenceLabel}`;
      if (!val || seen.has(val)) continue;
      seen.set(val, {
        value: val,
        label: row.referenceLabel || "No source of funds",
      });
    }
    return [
      { value: "all", label: "All references" },
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [allRows]);
  const categoryOptions = useMemo(() => {
    const seen = new Map();
    for (const row of allRows) {
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
  }, [allRows]);
  const statusOptions = useMemo(() => {
    const seen = new Map();
    for (const row of allRows) {
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
  }, [allRows]);
  const draft = useMemo(
    () => ({ type: tab, direction, employee, reference, category, status }),
    [tab, direction, employee, reference, category, status],
  );
  const dateFilteredRows = useMemo(
    () =>
      allRows.filter((row) =>
        matchesDayRange(row.date, dateRange?.start, dateRange?.end),
      ),
    [allRows, dateRange],
  );
  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return dateFilteredRows.filter((row) => matchesFilters(row, draft, query));
  }, [dateFilteredRows, draft, debouncedSearch]);
  const statsDraft = useMemo(
    () => ({
      type: "all",
      direction,
      employee,
      reference,
      category,
      status,
    }),
    [direction, employee, reference, category, status],
  );
  const statsRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return dateFilteredRows.filter((row) =>
      matchesFilters(row, statsDraft, query),
    );
  }, [dateFilteredRows, statsDraft, debouncedSearch]);
  const countLedgerMatches = useCallback(
    (candidate) => {
      const query = debouncedSearch.trim().toLowerCase();
      return dateFilteredRows.filter((row) =>
        matchesFilters(row, candidate, query),
      ).length;
    },
    [dateFilteredRows, debouncedSearch],
  );
  const totals = useMemo(() => {
    let given = 0;
    let abonoIn = 0;
    let abonoCount = 0;
    let issued = 0;
    let issuedCount = 0;
    let spent = 0;
    let spentCount = 0;
    const givenSourceKeys = new Set();
    for (const row of statsRows) {
      if (row.kind === "budget") {
        given += Number(row.moneyIn) || 0;
        givenSourceKeys.add(row.referenceId ?? `label:${row.referenceLabel}`);
      }
      if (row.kind === "abono" && row.status === "open") {
        abonoIn += Number(row.moneyIn) || 0;
        abonoCount += 1;
      }
      if (row.kind === "issued") {
        issued += Number(row.moneyOut) || 0;
        issuedCount += 1;
      }
      if (row.kind === "expense" && row.employeeRole !== "employee") {
        spent += Number(row.moneyOut) || 0;
        spentCount += 1;
      }
    }
    const r = (n) => Math.round(n * 100) / 100;
    const moneyIn = r(given + abonoIn);
    const moneyOut = r(issued + spent);
    return {
      moneyIn,
      moneyOut,
      given: r(given),
      givenSources: givenSourceKeys.size,
      abonoIn: r(abonoIn),
      abonoCount,
      issued: r(issued),
      issuedCount,
      spent: r(spent),
      spentCount,
    };
  }, [statsRows]);
  const kindCounts = useMemo(() => {
    const counts = {};
    for (const row of filteredRows)
      counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    return counts;
  }, [filteredRows]);
  const recordWindow = useMemo(() => rowsWindow(filteredRows), [filteredRows]);
  const inRows = useMemo(
    () =>
      statsRows.filter(
        (r) =>
          r.kind === "budget" || (r.kind === "abono" && r.status === "open"),
      ),
    [statsRows],
  );
  const outRows = useMemo(
    () =>
      statsRows.filter(
        (r) =>
          r.kind === "issued" ||
          (r.kind === "expense" && r.employeeRole !== "employee"),
      ),
    [statsRows],
  );
  const inWindow = useMemo(() => rowsWindow(inRows), [inRows]);
  const outWindow = useMemo(() => rowsWindow(outRows), [outRows]);
  const inSeries = useMemo(
    () => buildRangeSeries(inWindow, inRows, (r) => Number(r.moneyIn) || 0),
    [inWindow, inRows],
  );
  const outSeries = useMemo(
    () => buildRangeSeries(outWindow, outRows, (r) => Number(r.moneyOut) || 0),
    [outWindow, outRows],
  );
  const countSeries = useMemo(
    () => buildRangeSeries(recordWindow, filteredRows, () => 1),
    [recordWindow, filteredRows],
  );
  const rangeLabel = shortRangeLabel(dateRange);
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
  const hasActiveFilters =
    hasDateRange ||
    tab !== "all" ||
    direction !== "all" ||
    employee !== "all" ||
    reference !== "all" ||
    category !== "all" ||
    status !== "all" ||
    search.trim().length > 0;
  const clearFilters = () => {
    setDateRange(emptyDateRange());
    setTab("all");
    setDirection("all");
    setEmployee("all");
    setReference("all");
    setCategory("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };
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
        <p className="truncate text-base font-semibold text-[var(--ink)]">
          {confirmAction.row.description || "Untitled transaction"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {TRANSACTION_KIND_META[confirmAction.row.kind]?.label ?? ""} ·{" "}
          {formatDate(confirmAction.row.date)}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
        {formatMoney(confirmAction.row.amount)}
      </span>
    </div>
  ) : null;
  const filterLabels = {
    direction: DIRECTION_OPTIONS.find((o) => o.value === direction)?.label,
    employee: employeeOptions.find((o) => o.value === employee)?.label,
    reference: referenceOptions.find((o) => o.value === reference)?.label,
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
    for (const key of FILTER_KEYS) {
      const active =
        key === "direction"
          ? direction
          : key === "employee"
            ? employee
            : key === "reference"
              ? reference
              : key === "category"
                ? category
                : status;
      if (active === "all") continue;
      const onClear =
        key === "direction"
          ? () => {
              setDirection("all");
              setPage(0);
            }
          : key === "employee"
            ? () => {
                setEmployee("all");
                setPage(0);
              }
            : key === "reference"
              ? () => {
                  setReference("all");
                  setPage(0);
                }
              : key === "category"
                ? () => {
                    setCategory("all");
                    setPage(0);
                  }
                : () => {
                    setStatus("all");
                    setPage(0);
                  };
      chips.push({ key, label: filterLabels[key] ?? key, onClear });
    }
    return chips;
  }, [tab, direction, employee, reference, category, status]);
  const applyMobileFilters = (next) => {
    setTab(next.type);
    setDirection(next.direction);
    setEmployee(next.employee);
    setReference(next.reference);
    setCategory(next.category);
    setStatus(next.status);
    setPage(0);
  };
  const renderFilter = (key) => {
    const shared = { portal: true };
    switch (key) {
      case "direction":
        return (
          <Listbox
            {...shared}
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setPage(0);
            }}
            placeholder="All flows"
          />
        );
      case "employee":
        return (
          <Listbox
            {...shared}
            searchable
            options={employeeOptions}
            value={employee}
            onChange={(v) => {
              setEmployee(v);
              setPage(0);
            }}
            placeholder="All employees"
          />
        );
      case "reference":
        return (
          <Listbox
            {...shared}
            searchable
            options={referenceOptions}
            value={reference}
            onChange={(v) => {
              setReference(v);
              setPage(0);
            }}
            placeholder="All references"
          />
        );
      case "category":
        return (
          <Listbox
            {...shared}
            options={categoryOptions}
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
            placeholder="All categories"
          />
        );
      case "status":
        return (
          <Listbox
            {...shared}
            options={statusOptions}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
            placeholder="All statuses"
          />
        );
      default:
        return null;
    }
  };
  const mobileFiltersLabel =
    mobileFilterChips.length > 0
      ? `Filter ledger — ${mobileFilterChips.length} ${
          mobileFilterChips.length === 1 ? "filter" : "filters"
        } active`
      : "Filter ledger";
  const searchField = (
    <div className="flex w-full items-center gap-2">
      <SearchInput
        leftIcon={<Search size={16} />}
        placeholder="Search transactions…"
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
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Transactions"
        description="All budget, expense, abono and transfer activity in one ledger."
      />
      <section aria-label="Transactions overview">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
        >
          <motion.div variants={item} className="min-w-0 [&>div]:h-full">
            <StatCard
              label="Money In"
              value={formatMoney(totals.moneyIn)}
              icon={TrendingUp}
              loading={isLoading}
              accent
              chart="bars"
              data={inSeries}
              stats={[
                {
                  key: "given",
                  label: "Budget Given",
                  value: formatMoney(totals.given),
                  hint: `${totals.givenSources} ${
                    totals.givenSources === 1 ? "source" : "sources"
                  }`,
                },
                {
                  key: "abono",
                  label: "Abono",
                  value: formatMoney(totals.abonoIn),
                  hint: `${totals.abonoCount} ${
                    totals.abonoCount === 1 ? "abono" : "abonos"
                  }`,
                },
              ]}
            />
          </motion.div>
          <motion.div variants={item} className="min-w-0 [&>div]:h-full">
            <StatCard
              label="Money Out"
              value={formatMoney(totals.moneyOut)}
              icon={TrendingDown}
              loading={isLoading}
              tone="danger"
              chart="bars"
              data={outSeries}
              stats={[
                {
                  key: "issued",
                  label: "Total Issued",
                  value: formatMoney(totals.issued),
                  hint: `${totals.issuedCount} issued`,
                },
                {
                  key: "spent",
                  label: "Expenses",
                  value: formatMoney(totals.spent),
                  hint: `${totals.spentCount} ${
                    totals.spentCount === 1 ? "expense" : "expenses"
                  }`,
                },
              ]}
            />
          </motion.div>
          <motion.div
            variants={item}
            className="min-w-0 sm:col-span-2 xl:col-span-1 [&>div]:h-full"
          >
            <StatCard
              label="Records"
              value={filteredRows.length}
              icon={ClipboardList}
              loading={isLoading}
              chart="bars"
              data={countSeries}
              stats={[
                {
                  key: "given-count",
                  label: "Budget Added",
                  value: kindCounts.budget ?? 0,
                },
                {
                  key: "expense-count",
                  label: "Expenses",
                  value: kindCounts.expense ?? 0,
                },
                {
                  key: "transfer-count",
                  label: "Transfers",
                  value:
                    (kindCounts.transfer_sent ?? 0) +
                    (kindCounts.transfer_received ?? 0),
                },
              ]}
            />
          </motion.div>
        </motion.div>
      </section>
      <Card padding="lg" radius="lg" className="relative overflow-visible">
        <CardHeader className="mb-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">All Transactions</CardTitle>
            <CardDescription className="mt-0.5">
              <span className="inline-flex flex-wrap items-center gap-1.5">
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
                    ? "· transactions in this range"
                    : "· showing all transactions"}
                </span>
              </span>
            </CardDescription>
          </div>
          {!isLoading && !error && (
            <Badge
              tone="neutral"
              className="hidden shrink-0 tabular-nums sm:inline-flex"
            >
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "record" : "records"}
            </Badge>
          )}
        </CardHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setPage(0);
          }}
        >
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
                  <span className="whitespace-nowrap text-xs font-semibold">
                    {label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-start">
          <div className="flex items-center gap-2 2xl:hidden">
            <div className="min-w-0 flex-1">{searchField}</div>
            <IconButton
              type="button"
              aria-label={mobileFiltersLabel}
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
          {/* Desktop filters — pure CSS grid: every filter is always mounted
              and always visible, columns just reflow as the card narrows. No
              measuring, no sliding track, no translateX, so resizing can never
              flash a horizontal scrollbar or shuffle which filters are on
              screen. Same records stay mounted. */}
          <div
            role="group"
            aria-label="Transaction filters"
            className="hidden min-w-0 flex-1 grid-cols-5 gap-2 2xl:grid"
          >
            {FILTER_KEYS.map((key) => (
              <div key={key} className="min-w-0">
                {renderFilter(key)}
              </div>
            ))}
          </div>

          {/* Mid widths (lg–2xl): filters get their own full-width row above
              search so nothing squeezes into a shrunken sliding window. */}
          <div
            role="group"
            aria-label="Transaction filters"
            className="hidden min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid xl:grid-cols-5 2xl:hidden"
          >
            {FILTER_KEYS.map((key) => (
              <div key={key} className="min-w-0">
                {renderFilter(key)}
              </div>
            ))}
          </div>
          <div className="hidden min-w-0 2xl:ml-auto 2xl:block 2xl:w-[420px] 2xl:shrink-0">
            {searchField}
          </div>
        </div>
        <FilterChips
          chips={mobileFilterChips}
          onClearAll={() => {
            setTab("all");
            setDirection("all");
            setEmployee("all");
            setReference("all");
            setCategory("all");
            setStatus("all");
            setPage(0);
          }}
        />
        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title="Couldn't load transactions"
            message="Something went wrong while fetching the ledger."
            onRetry={refetch}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              hasActiveFilters
                ? "No records match your filters"
                : "No transactions yet"
            }
            message={
              hasActiveFilters
                ? hasDateRange
                  ? "Try a wider date range, another tab, or a different search term."
                  : "Try another tab, filter, or search term."
                : "Records appear here as soon as budgets, expenses, abono or transfers are created."
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            <TransactionsTable
              rows={pageRows}
              pending={confirmPending}
              onAction={handleAction}
            />
            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                Showing{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {filteredRows.length}
                </span>{" "}
                {filteredRows.length === 1 ? "record" : "records"}
                {hasDateRange && (
                  <span className="ml-1.5 opacity-60">· {rangeLabel}</span>
                )}
              </p>
              {pageCount > 1 && (
                <div className="sm:ml-auto">
                  <Pager
                    page={currentPage}
                    pageCount={pageCount}
                    onChange={setPage}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <TransactionDetailsModal
        open={viewOpen}
        row={viewRow}
        onClose={() => setViewOpen(false)}
      />
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
      <TransactionsMobileFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        type={tab}
        direction={direction}
        employee={employee}
        reference={reference}
        category={category}
        status={status}
        typeOptions={TYPE_OPTIONS}
        directionOptions={DIRECTION_OPTIONS}
        employeeOptions={employeeOptions}
        referenceOptions={referenceOptions}
        categoryOptions={categoryOptions}
        statusOptions={statusOptions}
        onApply={applyMobileFilters}
        onClearAll={clearFilters}
        countMatches={countLedgerMatches}
        totalRows={dateFilteredRows.length}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
};

export default AdminTransaction;
