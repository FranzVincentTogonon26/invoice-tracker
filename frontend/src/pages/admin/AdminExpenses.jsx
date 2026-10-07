import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, CalendarRange, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { formatDate, formatMoney, startOfDay } from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import {
  EXPENSE_LEDGER_STATUS_META,
  EXPENSE_LEDGER_STATUS_ORDER,
  EXPENSE_STATUS_OPTIONS,
  PAYMENT_METHODS,
} from "../../constants";
import { useExpenses, useExpensesMutations } from "../../hooks/useExpenses";
import ConfirmActionDialog from "../../components/layout/admin/expenses/ConfirmActionDialog";
import ExpenseDetailsModal from "../../components/layout/admin/expenses/ExpenseDetailsModal";
import { ExpenseOverview } from "../../components/layout/admin/expenses/ExpenseOverview";
import { ExpenseFilterBar } from "../../components/layout/admin/expenses/ExpenseFilterBar";
import { ExpenseLedger } from "../../components/layout/admin/expenses/ExpenseLedger";
import {
  buildRangeSeries,
  countDays,
  emptyRange,
  matchesDayRange,
  matchesLedgerFilters,
  rowsWindow,
  shortRangeLabel,
} from "../../lib/expenseLedger";
import {
  ACTION_ERROR,
  CONFIRM_COPY,
} from "../../components/layout/admin/expenses/ExpenseDialogCopy";

const PAGE_SIZE = 100;

const AdminExpenses = () => {
  const nav = useNavigate();
  const [dateRange, setDateRange] = useState(() => emptyRange());

  const { data, expenses, categories, references, isLoading, error, refetch } =
    useExpenses();

  const {
    remove,
    markEmployeeDraft,
    markEmployeePaid,
    setStatus: setExpenseStatus,
  } = useExpensesMutations();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [employee, setEmployee] = useState("all");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overview = data?.overview ?? {};
  const totalBudget = Number(overview.totalBudget ?? 0);
  const totalIssued = Number(overview.totalIssued ?? 0);
  const totalExpenses = Number(overview.totalExpenses ?? 0);
  const cashOnHand = totalBudget - (totalIssued + totalExpenses);
  const isBalanceOverdrawn = cashOnHand < -0.004;
  const isBalanceDepleted =
    !isBalanceOverdrawn && Math.abs(cashOnHand) < 0.005 && totalBudget > 0;

  const activeExpenses = useMemo(
    () =>
      (expenses ?? []).filter(
        (e) => e.status !== "cancel" && e.created_by_role !== "employee",
      ),
    [expenses],
  );

  const activeTotal = useMemo(
    () =>
      activeExpenses.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0),
    [activeExpenses],
  );

  const totalSpend = useMemo(
    () => totalIssued + activeTotal,
    [totalIssued, activeTotal],
  );

  const referenceLabels = useMemo(
    () => new Map((references ?? []).map((r) => [r.reference_id, r.label])),
    [references],
  );

  const allLedgerRows = useMemo(
    () =>
      (expenses ?? [])
        .map((e) => ({
          id: e.id,
          date: e.expense_date,
          timeDate: e.created_at,
          description: e.description,
          category: e.category_name,
          categoryId: e.category_id,
          amount: Number(e.total_amount) || 0,
          employeeId: e.user_id,
          employee: e.created_by,
          employeeRole: e.created_by_role,
          employeeAvatar: e.created_by_avatar,
          method: e.payment_method,
          status: e.status,
          flagged: Number(e.flag) === 1,
          notes: e.notes,
          referenceId: e.reference_id,
          sourceOfFunds:
            e.reference_label ||
            (e.reference_id ? referenceLabels.get(e.reference_id) : "") ||
            (e.created_by_role === "employee"
              ? "Employee balance"
              : "No source of funds"),
          receiptId: e.receipt_id,
          imageUrl: e.image_url,
          receiptDate: e.receipt_date,
        }))
        .sort((a, b) => {
          const ta = new Date(a.timeDate ?? a.date ?? 0).getTime() || 0;
          const tb = new Date(b.timeDate ?? b.date ?? 0).getTime() || 0;

          return tb - ta;
        }),
    [expenses, referenceLabels],
  );

  const spendRows = useMemo(
    () =>
      allLedgerRows.filter(
        (row) => row.status !== "cancel" && row.employeeRole !== "employee",
      ),
    [allLedgerRows],
  );

  // The date-range picker filters on the date the TABLE shows: `timeDate`
  // (`expenses.created_at`) — the same value ExpensesTable renders in its Date
  // column and the same one `allLedgerRows` sorts by. Filtering on `date`
  // (the `expense_date` tag) hid rows whose VISIBLE date sat inside the picked
  // range whenever the two differed (e.g. a line saved today carrying a
  // backdated expense_date). `?? r.date` mirrors the sort's fallback.
  const ledgerRows = useMemo(
    () =>
      allLedgerRows.filter((r) =>
        matchesDayRange(r.timeDate ?? r.date, dateRange?.start, dateRange?.end),
      ),
    [allLedgerRows, dateRange],
  );

  const rangeLabel = shortRangeLabel(dateRange);

  const spendWindow = useMemo(() => rowsWindow(spendRows), [spendRows]);

  const recordWindow = useMemo(
    () => rowsWindow(allLedgerRows),
    [allLedgerRows],
  );

  const spendSeries = useMemo(
    () => buildRangeSeries(spendWindow, spendRows, (row) => row.amount),
    [spendWindow, spendRows],
  );

  const recordSeries = useMemo(
    () => buildRangeSeries(recordWindow, allLedgerRows, () => 1),
    [recordWindow, allLedgerRows],
  );

  const paceDays = useMemo(() => {
    const start = spendWindow?.start ? startOfDay(spendWindow.start) : null;
    const end = spendWindow?.end ? startOfDay(spendWindow.end) : null;

    return start && end && end >= start ? countDays(start, end) : 0;
  }, [spendWindow]);

  const dailyAverage = paceDays > 0 ? totalSpend / paceDays : 0;

  const topCategory = useMemo(() => {
    const totals = new Map();

    for (const e of activeExpenses) {
      const key = e.category_name || "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + (Number(e.total_amount) || 0));
    }

    const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];

    return top ? top[0] : null;
  }, [activeExpenses]);

  const heroStats = useMemo(
    () => [
      {
        key: "top",
        label: "Top category",
        value: topCategory ?? "Budget Issued",
      },
      {
        key: "pace",
        label: "Avg / day",
        value: paceDays > 0 ? formatMoney(dailyAverage) : "—",
      },
    ],
    [topCategory, dailyAverage, paceDays],
  );

  const balanceStats = useMemo(
    () => [
      {
        key: "allocated",
        label: "Allocated",
        value: formatMoney(totalBudget),
      },
      {
        key: "issued",
        label: "Issued",
        value:
          totalIssued > 0 ? `-${formatMoney(totalIssued)}` : formatMoney(0),
        tone: "warning",
      },
      {
        key: "expenses",
        label: "Spent",
        value:
          totalExpenses > 0 ? `-${formatMoney(totalExpenses)}` : formatMoney(0),
        tone: "danger",
      },
    ],
    [totalBudget, totalIssued, totalExpenses],
  );

  const issuedSources = overview.overviewIssuedBudget;

  const issuedStats = useMemo(() => {
    const rows = issuedSources ?? [];

    const largest = rows.reduce(
      (max, row) => Math.max(max, Number(row.amount) || 0),
      0,
    );

    return [
      { key: "sources", label: "Budget Sources", value: rows.length },
      { key: "largest", label: "Largest", value: formatMoney(largest) },
    ];
  }, [issuedSources]);

  const statusStats = useMemo(() => {
    const counts = new Map();

    for (const row of allLedgerRows) {
      const rowStatus = row.status || "draft";
      counts.set(rowStatus, (counts.get(rowStatus) ?? 0) + 1);
    }

    const order = [
      ...EXPENSE_LEDGER_STATUS_ORDER.filter((rowStatus) =>
        counts.has(rowStatus),
      ),
      ...[...counts.keys()].filter(
        (rowStatus) => !EXPENSE_LEDGER_STATUS_ORDER.includes(rowStatus),
      ),
    ];

    return order.map((rowStatus) => {
      const meta = EXPENSE_LEDGER_STATUS_META[rowStatus] ?? {
        tone: "neutral",
        label: rowStatus,
      };

      return {
        key: rowStatus,
        label: meta.label,
        value: counts.get(rowStatus),
        tone: meta.tone,
      };
    });
  }, [allLedgerRows]);

  const flaggedCount = useMemo(
    () => allLedgerRows.filter((row) => row.flagged).length,
    [allLedgerRows],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((c) => ({
        value: c.category_id,
        label: c.category_name,
      })),
    ],
    [categories],
  );

  const employeeOptions = useMemo(() => {
    const seen = new Map();

    for (const row of allLedgerRows) {
      if (!row.employeeId || seen.has(row.employeeId)) continue;

      seen.set(row.employeeId, {
        value: row.employeeId,
        label: row.employee || "Unknown",
        avatar: row.employeeAvatar || "",
      });
    }

    return [
      { value: "all", label: "All Employee" },
      ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [allLedgerRows]);

  const methodOptions = useMemo(
    () => [{ value: "all", label: "All methods" }, ...PAYMENT_METHODS],
    [],
  );

  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return ledgerRows.filter((row) =>
      matchesLedgerFilters(row, {
        category,
        employee,
        method,
        status,
        query,
      }),
    );
  }, [ledgerRows, category, employee, method, status, debouncedSearch]);

  const countLedgerMatches = useCallback(
    (draft) => {
      const query = debouncedSearch.trim().toLowerCase();

      return ledgerRows.filter((row) =>
        matchesLedgerFilters(row, { ...draft, query }),
      ).length;
    },
    [ledgerRows, debouncedSearch],
  );

  const mobileFilterChips = useMemo(() => {
    const chips = [];

    if (employee !== "all") {
      chips.push({
        key: "employee",
        label:
          employeeOptions.find((o) => o.value === employee)?.label ??
          "Employee",
        onClear: () => {
          setEmployee("all");
          setPage(0);
        },
      });
    }

    if (category !== "all") {
      chips.push({
        key: "category",
        label:
          categoryOptions.find((o) => o.value === category)?.label ??
          "Category",
        onClear: () => {
          setCategory("all");
          setPage(0);
        },
      });
    }

    if (method !== "all") {
      chips.push({
        key: "method",
        label: methodOptions.find((o) => o.value === method)?.label ?? "Method",
        onClear: () => {
          setMethod("all");
          setPage(0);
        },
      });
    }

    if (status !== "all") {
      chips.push({
        key: "status",
        label:
          EXPENSE_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
          "Status",
        onClear: () => {
          setStatus("all");
          setPage(0);
        },
      });
    }

    return chips;
  }, [
    category,
    categoryOptions,
    employee,
    employeeOptions,
    method,
    methodOptions,
    status,
  ]);

  const applyMobileFilters = ({
    category: nextCategory,
    employee: nextEmployee,
    method: nextMethod,
    status: nextStatus,
  }) => {
    setCategory(nextCategory);
    setEmployee(nextEmployee);
    setMethod(nextMethod);
    setStatus(nextStatus);
    setPage(0);
  };

  const handleFilterChange = (key, value) => {
    if (key === "employee") setEmployee(value);
    else if (key === "category") setCategory(value);
    else if (key === "method") setMethod(value);
    else if (key === "status") setStatus(value);
    setPage(0);
  };

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

  const total = useMemo(
    () =>
      filteredRows.reduce(
        (sum, r) =>
          r.status === "cancel" || r.employeeRole === "employee"
            ? sum
            : sum + (Number(r.amount) || 0),
        0,
      ),
    [filteredRows],
  );

  const rangeStart =
    filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRows.length, (currentPage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    hasDateRange ||
    employee !== "all" ||
    category !== "all" ||
    method !== "all" ||
    status !== "all" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setDateRange(emptyRange());
    setEmployee("all");
    setCategory("all");
    setMethod("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  const emptyFilterMessage = hasDateRange
    ? "Try a wider date range, a different category, or a different search term."
    : "Try a different category or search term.";

  const handleViewRow = (row) => {
    setViewRow(row);
    setViewOpen(true);
  };

  const requestDelete = (row) => {
    setConfirmAction({ row, action: "delete" });
    setConfirmOpen(true);
  };

  const requestAddToDraft = (row) => {
    setConfirmAction({ row, action: "draft" });
    setConfirmOpen(true);
  };

  const requestRemoveFromDraft = (row) => {
    setConfirmAction({ row, action: "restore" });
    setConfirmOpen(true);
  };

  const requestCancelExpense = (row) => {
    setConfirmAction({ row, action: "cancel" });
    setConfirmOpen(true);
  };

  const confirmPending =
    remove.isPending ||
    markEmployeeDraft.isPending ||
    markEmployeePaid.isPending ||
    setExpenseStatus.isPending;

  const closeConfirm = () => {
    if (!confirmPending) setConfirmOpen(false);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;

    const { action, row } = confirmAction;

    try {
      if (action === "draft") {
        await markEmployeeDraft.mutateAsync(row.id);
        toast.success("Expense added to draft");
      } else if (action === "restore") {
        await markEmployeePaid.mutateAsync(row.id);
        toast.success("Expense marked as paid");
      } else if (action === "cancel") {
        await setExpenseStatus.mutateAsync({ id: row.id, status: "cancel" });
        toast.success("Expense cancelled");
      } else {
        await remove.mutateAsync(row.id);
        toast.success("Expense deleted");
      }
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err?.message || ACTION_ERROR[action] || ACTION_ERROR.delete);
    }
  };

  const confirmSummary = confirmAction ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {confirmAction.row.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${confirmAction.row.category || "Uncategorized"} · ${formatDate(confirmAction.row.date)}`}
        </p>
      </div>

      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(confirmAction.row.amount)}
      </span>
    </div>
  ) : null;

  const confirmCopyBase =
    CONFIRM_COPY[confirmAction?.action] ?? CONFIRM_COPY.delete;
  // Drafting a cancelled row keeps the row out of "paid" wording — the dismiss
  // action reads "Keep cancelled" instead of "Keep as paid".
  const confirmCopy =
    confirmAction?.action === "draft" && confirmAction?.row?.status === "cancel"
      ? { ...confirmCopyBase, cancelLabel: "Keep cancelled" }
      : confirmCopyBase;

  const mobileFiltersLabel =
    mobileFilterChips.length > 0
      ? `Filter ledger — ${mobileFilterChips.length} ${
          mobileFilterChips.length === 1 ? "filter" : "filters"
        } active`
      : "Filter ledger";

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Expenses"
        description="Track expenses against your budget"
        actions={
          <div className="flex w-full flex-nowrap items-center justify-end gap-2 sm:w-auto">
            <Button
              variant="accent"
              onClick={() => nav("/admin/expenses/add")}
              className="shrink-0"
            >
              <Plus size={15} /> Add Expense
            </Button>
          </div>
        }
      />

      <ExpenseOverview
        isLoading={isLoading}
        totalSpend={totalSpend}
        spendSeries={spendSeries}
        heroStats={heroStats}
        cashOnHand={cashOnHand}
        isBalanceOverdrawn={isBalanceOverdrawn}
        isBalanceDepleted={isBalanceDepleted}
        balanceStats={balanceStats}
        totalIssued={totalIssued}
        issuedStats={issuedStats}
        recordCount={allLedgerRows.length}
        recordSeries={recordSeries}
        statusStats={statusStats}
        flaggedCount={flaggedCount}
      />

      <Card padding="lg" className="relative rounded-3xl px-2 sm:px-6">
        <CardHeader>
          <div>
            <CardTitle className="text-lg">All Expenses</CardTitle>

            <CardDescription className="text-sm">
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
                    ? "· expenses in this range"
                    : "· no date range set — showing all expenses"}
                </span>
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <ExpenseFilterBar
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
          filters={{ employee, category, method, status }}
          onFilterChange={handleFilterChange}
          options={{
            employee: employeeOptions,
            category: categoryOptions,
            method: methodOptions,
            status: EXPENSE_STATUS_OPTIONS,
          }}
          chips={mobileFilterChips}
          onClearAllFilters={() => {
            setEmployee("all");
            setCategory("all");
            setMethod("all");
            setStatus("all");
            setPage(0);
          }}
          filtersOpen={filtersOpen}
          onOpenFilters={setFiltersOpen}
          mobileFiltersLabel={mobileFiltersLabel}
          countMatches={countLedgerMatches}
          totalRows={ledgerRows.length}
          hasActiveFilters={hasActiveFilters}
          onApplyMobile={applyMobileFilters}
          onClearMobile={clearFilters}
        />

        <ExpenseLedger
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          emptyFilterMessage={emptyFilterMessage}
          pageRows={pageRows}
          pending={
            remove.isPending ||
            markEmployeeDraft.isPending ||
            markEmployeePaid.isPending ||
            setExpenseStatus.isPending
          }
          onView={handleViewRow}
          onDelete={requestDelete}
          onAddToDraft={requestAddToDraft}
          onRemoveFromDraft={requestRemoveFromDraft}
          onCancelExpense={requestCancelExpense}
          filteredRows={filteredRows}
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={setPage}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          total={total}
        />
      </Card>

      <ExpenseDetailsModal
        open={viewOpen}
        expense={viewRow}
        referenceLabel={viewRow?.sourceOfFunds ?? ""}
        onClose={() => setViewOpen(false)}
        onFlagCleared={(id) =>
          setViewRow((prev) =>
            prev && prev.id === id ? { ...prev, flagged: false } : prev,
          )
        }
      />

      <ConfirmActionDialog
        open={confirmOpen}
        icon={confirmCopy.icon}
        title={confirmCopy.title}
        description={confirmCopy.description}
        summary={confirmSummary}
        cancelLabel={confirmCopy.cancelLabel}
        confirmLabel={confirmCopy.confirmLabel}
        pendingLabel={confirmCopy.pendingLabel}
        pending={confirmPending}
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
};

export default AdminExpenses;
