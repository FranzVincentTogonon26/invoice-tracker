import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, CalendarRange } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "../../components/ui/Badge";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  emptyDateRange,
  formatDate,
  formatMoney,
  matchesDayRange,
} from "../../lib/utils";
import {
  TRANSACTION_DIRECTION_OPTIONS,
  TRANSACTION_KIND_META,
  TRANSACTION_TYPE_OPTIONS,
} from "../../constants";
import {
  useTransactions,
  useTransactionsMutations,
} from "../../hooks/useTransactions";
import TransactionDetailsModal from "../../components/layout/admin/transactions/TransactionDetailsModal";
import { TransactionOverview } from "../../components/layout/admin/transactions/TransactionOverview";
import {
  TransactionFilterBar,
  TYPE_TABS,
} from "../../components/layout/admin/transactions/TransactionFilterBar";
import { TransactionLedger } from "../../components/layout/admin/transactions/TransactionLedger";
import ConfirmActionDialog from "../../components/layout/admin/expenses/ConfirmActionDialog";
import {
  buildRangeSeries,
  matchesFilters,
  rowsWindow,
  shortRangeLabel,
} from "../../lib/transactionLedger";
import {
  ACTION_ERROR,
  CONFIRM_COPY,
} from "../../components/layout/admin/transactions/TransactionDialogCopy";

const PAGE_SIZE = 100;
const SYSTEM_EMPLOYEE_VALUE = "__system";

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
  const filterLabels = {
    direction: TRANSACTION_DIRECTION_OPTIONS.find((o) => o.value === direction)
      ?.label,
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
    const entries = [
      ["direction", direction, setDirection],
      ["employee", employee, setEmployee],
      ["reference", reference, setReference],
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
    // filterLabels is derived from the same filter states each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const handleFilterChange = (key, value) => {
    if (key === "direction") setDirection(value);
    else if (key === "employee") setEmployee(value);
    else if (key === "reference") setReference(value);
    else if (key === "category") setCategory(value);
    else if (key === "status") setStatus(value);
    setPage(0);
  };
  const mobileFiltersLabel =
    mobileFilterChips.length > 0
      ? `Filter ledger — ${mobileFilterChips.length} ${
          mobileFilterChips.length === 1 ? "filter" : "filters"
        } active`
      : "Filter ledger";

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Transactions"
        description="All budget, expense, abono and transfer activity in one ledger."
      />
      <TransactionOverview
        isLoading={isLoading}
        totals={totals}
        inSeries={inSeries}
        outSeries={outSeries}
        countSeries={countSeries}
        recordCount={filteredRows.length}
        kindCounts={kindCounts}
      />
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
        <TransactionFilterBar
          tab={tab}
          onTabChange={(v) => {
            setTab(v);
            setPage(0);
          }}
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(0);
          }}
          dateRange={dateRange}
          onDateRange={(r) => {
            setDateRange(r);
            setPage(0);
          }}
          filters={{ direction, employee, reference, category, status }}
          onFilterChange={handleFilterChange}
          options={{
            direction: TRANSACTION_DIRECTION_OPTIONS,
            employee: employeeOptions,
            reference: referenceOptions,
            category: categoryOptions,
            status: statusOptions,
            type: TRANSACTION_TYPE_OPTIONS,
          }}
          chips={mobileFilterChips}
          onClearAllChips={() => {
            setTab("all");
            setDirection("all");
            setEmployee("all");
            setReference("all");
            setCategory("all");
            setStatus("all");
            setPage(0);
          }}
          filtersOpen={filtersOpen}
          onOpenFilters={setFiltersOpen}
          mobileFiltersLabel={mobileFiltersLabel}
          countMatches={countLedgerMatches}
          totalRows={dateFilteredRows.length}
          hasActiveFilters={hasActiveFilters}
          onApplyMobile={applyMobileFilters}
          onClearMobile={clearFilters}
        />
        <TransactionLedger
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
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
    </div>
  );
};

export default AdminTransaction;
