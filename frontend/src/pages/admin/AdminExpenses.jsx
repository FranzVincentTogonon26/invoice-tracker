import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarOff,
  CalendarRange,
  CircleAlert,
  CircleX,
  ClipboardList,
  HandCoins,
  Plus,
  ReceiptText,
  Search,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
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
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/DataState";
import { Pager } from "../../components/ui/Pager";
import { cn, formatMoney, startOfDay, toDate } from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PAYMENT_METHODS } from "../../constants";
import { useExpenses, useExpensesMutations } from "../../hooks/useExpenses";
import {
  useBudgetIssuedTransaction,
  useBudgetMutations,
} from "../../hooks/useBudget";
import ExpensesTable from "../../components/layout/admin/expenses/ExpensesTable";

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

const PAGE_SIZE = 50;
const emptyRange = () => ({ start: null, end: null });

const STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "close", label: "Closed (issued)" },
  { value: "cancel", label: "Cancelled" },
];

const dayOf = (value) => {
  const parsed = toDate(value);
  return parsed ? startOfDay(parsed) : null;
};

const rowDay = (row) => dayOf(row?.expense_date ?? row?.date);

const matchesDayRange = (value, start, end) => {
  const day = dayOf(value);
  if (!day) return true;
  if (start && day < startOfDay(start)) return false;
  if (end && day > startOfDay(end)) return false;
  return true;
};

const LEDGER_STATUS_META = {
  paid: { tone: "success", label: "Paid" },
  open: { tone: "warning", label: "Open" },
  draft: { tone: "warning", label: "Draft" },
  close: { tone: "warning", label: "Closed" },
  cancel: { tone: "danger", label: "Cancelled" },
};

const LEDGER_STATUS_ORDER = ["paid", "open", "draft", "close", "cancel"];
const DAY_MS = 24 * 60 * 60 * 1000;

const countDays = (start, end) =>
  Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;

const shortRangeLabel = (range) => {
  if (!range?.start || !range?.end) return "";
  const withYear = range.start.getFullYear() !== range.end.getFullYear();
  const format = (day) =>
    day.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${format(range.start)} - ${format(range.end)}`;
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
    if (!day || day < start || day > end) continue;
    const bucket = Math.floor((countDays(start, day) - 1) / bucketDays);
    totals[bucket] += measure(row);
  }

  return totals.map((v) => ({ v }));
};

const rowsWindow = (rows) => {
  let start = null;
  let end = null;
  for (const row of rows) {
    const day = rowDay(row);
    if (!day) continue;
    if (!start || day < start) start = day;
    if (!end || day > end) end = day;
  }
  return start && end ? { start, end } : null;
};

const AdminExpenses = () => {
  const nav = useNavigate();
  const [dateRange, setDateRange] = useState(() => emptyRange());
  // Fetch every expense up front: the overview cards must not react to the
  // date range — the picker only narrows the table below (client-side).
  const { data, expenses, categories, isLoading, error, refetch } =
    useExpenses();
  const { remove } = useExpensesMutations();
  const { cancelIssuedTransaction, restoreIssuedTransaction } =
    useBudgetMutations();
  const queryClient = useQueryClient();

  const {
    data: issuedTransactions,
    isLoading: issuedLoading,
    error: issuedError,
    refetch: refetchIssued,
  } = useBudgetIssuedTransaction();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

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

  // Same cent-rounded depleted/overdrawn states as AdminBudget's My Balance
  // card: anything formatting as ₱0.00 warns, anything below warns harder.
  // Depleted only applies once there is an allocation to deplete.
  const isBalanceOverdrawn = cashOnHand < -0.004;
  const isBalanceDepleted =
    !isBalanceOverdrawn && Math.abs(cashOnHand) < 0.005 && totalBudget > 0;

  // Overview source — all-time: the date range never touches the cards
  // above, it only narrows the table further down.
  const activeExpenses = useMemo(
    () => (expenses ?? []).filter((e) => e.status !== "cancel"),
    [expenses],
  );

  const activeTotal = useMemo(
    () =>
      activeExpenses.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0),
    [activeExpenses],
  );

  // Total Expenses headline = open budget issuances + recorded expenses — the
  // exact money the My Balance card deducts from the allocation. `totalIssued`
  // is the Total Issued Budget card's value, so the two cards always agree.
  const totalSpend = useMemo(
    () => totalIssued + activeTotal,
    [totalIssued, activeTotal],
  );

  // Full ledger (expenses + budget issuances) for the overview cards.
  const allLedgerRows = useMemo(
    () =>
      [
        ...(expenses ?? []).map((e) => ({
          kind: "expense",
          id: e.id,
          date: e.expense_date,
          timeDate: e.created_at,
          description: e.description,
          category: e.category_name,
          categoryId: e.category_id,
          amount: Number(e.total_amount) || 0,
          employee: e.created_by,
          employeeRole: e.created_by_role,
          employeeAvatar: e.created_by_avatar,
          method: e.payment_method,
          status: e.status,
        })),
        ...(issuedTransactions ?? []).map((t) => ({
          kind: "issued",
          id: t.id,
          date: t.date_issued,
          timeDate: t.date_issued,
          description: t.description,
          category: t.source_of_funds,
          amount: Number(t.amount) || 0,
          employee: t.employee,
          employeeRole: t.employee_role,
          employeeAvatar: t.avatar_url,
          method: t.method,
          status: t.status,
        })),
      ].sort((a, b) => {
        const ta = new Date(a.timeDate ?? a.date ?? 0).getTime() || 0;
        const tb = new Date(b.timeDate ?? b.date ?? 0).getTime() || 0;
        return tb - ta;
      }),
    [expenses, issuedTransactions],
  );

  // Rows behind the Total Expenses headline: non-cancelled expenses plus the
  // budget issuances the Total Issued Budget card counts (only 'open'
  // references — 'close' / 'cancel' are excluded, exactly like the backend
  // overview). The card's chart and Avg / day come from this same set, so
  // every figure on the card reconciles with the headline.
  const spendRows = useMemo(
    () =>
      allLedgerRows.filter((row) =>
        row.kind === "expense"
          ? row.status !== "cancel"
          : row.status === "open",
      ),
    [allLedgerRows],
  );

  // Table source — the only thing the date range filters.
  const ledgerRows = useMemo(
    () =>
      allLedgerRows.filter((r) =>
        matchesDayRange(r.date, dateRange?.start, dateRange?.end),
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

  // Same measure as the headline, so the stat reconciles with it.
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
      const status = row.status || "draft";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    const order = [
      ...LEDGER_STATUS_ORDER.filter((status) => counts.has(status)),
      ...[...counts.keys()].filter(
        (status) => !LEDGER_STATUS_ORDER.includes(status),
      ),
    ];

    return order.map((status) => {
      const meta = LEDGER_STATUS_META[status] ?? {
        tone: "neutral",
        label: status,
      };
      return {
        key: status,
        label: meta.label,
        value: counts.get(status),
        tone: meta.tone,
      };
    });
  }, [allLedgerRows]);

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

  const methodOptions = useMemo(
    () => [{ value: "all", label: "All methods" }, ...PAYMENT_METHODS],
    [],
  );

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return ledgerRows.filter((r) => {
      if (
        category !== "all" &&
        r.kind === "expense" &&
        r.categoryId !== category
      )
        return false;
      if (method !== "all" && r.method !== method) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.description, r.category, r.employee, r.method]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [ledgerRows, category, method, status, debouncedSearch]);

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
    category !== "all" ||
    method !== "all" ||
    status !== "all" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setDateRange(emptyRange());
    setCategory("all");
    setMethod("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  const emptyFilterMessage = hasDateRange
    ? "Try a wider date range, a different category, or a different search term."
    : "Try a different category or search term.";

  const handleDelete = async (id) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Expense removed");
    } catch (err) {
      toast.error(err?.message || "Couldn't delete expense");
    }
  };

  const handleIssuedAction = async (action, row) => {
    if (action === "restore") {
      try {
        await restoreIssuedTransaction.mutateAsync({
          id: row.id,
          status: "open",
        });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        toast.success("Budget issuance restored");
      } catch (err) {
        toast.error(err?.message || "Couldn't restore budget issuance");
      }
      return;
    }

    if (action !== "cancel") return;

    try {
      await cancelIssuedTransaction.mutateAsync(row.id);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Budget issuance cancelled");
    } catch (err) {
      toast.error(err?.message || "Couldn't cancel budget issuance");
    }
  };

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Expenses"
        description="Track expenses against your budget"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <DateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(0);
              }}
              placeholder="All dates"
              align="end"
            />
            <Button variant="accent" onClick={() => nav("/admin/expenses/add")}>
              <Plus size={15} /> Add Expense
            </Button>
          </div>
        }
      />

      <section aria-label="Expenses overview" className="space-y-4">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
        >
          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Expenses"
              value={formatMoney(totalSpend)}
              icon={ReceiptText}
              loading={isLoading || issuedLoading}
              accent
              chart="bars"
              data={spendSeries}
              stats={heroStats}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="My Balance"
              value={formatMoney(cashOnHand)}
              icon={Wallet}
              loading={isLoading}
              tone={
                isBalanceOverdrawn
                  ? "danger"
                  : isBalanceDepleted
                    ? "warning"
                    : undefined
              }
              status={
                isBalanceOverdrawn
                  ? {
                      tone: "danger",
                      label: "Overdrawn — over budget",
                      icon: CircleX,
                    }
                  : isBalanceDepleted
                    ? {
                        tone: "warning",
                        label: "Depleted — no funds left",
                        icon: CircleAlert,
                      }
                    : undefined
              }
              stats={balanceStats}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Issued Budget"
              value={formatMoney(totalIssued)}
              icon={HandCoins}
              loading={isLoading}
              stats={issuedStats}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Transactions"
              value={allLedgerRows.length}
              icon={ClipboardList}
              loading={isLoading || issuedLoading}
              chart="bars"
              data={recordSeries}
              stats={statusStats}
            />
          </motion.div>
        </motion.div>

        <p className="px-1 text-xs text-[var(--ink-muted)]">
          Money figures exclude cancelled lines · Total Expenses adds open
          budget issuances to expenses · Transactions counts every row (expenses
          + budget issuances), cancelled included · The overview cards above are
          always all-time — charts and Avg / day span the records from first to
          last, and the date range only filters the table below
        </p>
      </section>

      <Card padding="lg" className="relative  rounded-3xl px-2 sm:px-6">
        <CardHeader>
          <div>
            <CardTitle className="text-lg">All Expenses</CardTitle>
            <CardDescription className="text-sm">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {hasDateRange ? (
                  <Badge tone="accent" className="font-semibold">
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
                    ? "· expenses and budget issuances in this range"
                    : "· no date range set — showing all expenses and budget issuances"}
                </span>
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div
            role="group"
            aria-label="Issued transaction filters"
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <div className="w-full lg:w-[200px] lg:shrink-0">
              <Listbox
                options={categoryOptions}
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  setPage(0);
                }}
                placeholder="All categories"
              />
            </div>
            <div className="w-full lg:w-[150px] lg:shrink-0">
              <Listbox
                options={methodOptions}
                value={method}
                onChange={(v) => {
                  setMethod(v);
                  setPage(0);
                }}
                placeholder="All methods"
              />
            </div>
            <div className="w-full lg:w-[150px] lg:shrink-0">
              <Listbox
                options={STATUS_OPTIONS}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(0);
                }}
                placeholder="All status"
              />
            </div>
          </div>

          <div className="lg:ml-auto lg:w-[450px]">
            <SearchInput
              leftIcon={<Search size={16} />}
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(0);
                    }}
                    aria-label="Clear search"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <X size={14} />
                  </button>
                ) : null
              }
            />
          </div>
        </div>

        {isLoading || issuedLoading ? (
          <LoadingSkeleton rows={6} />
        ) : error || issuedError ? (
          <ErrorState
            title="Couldn't load expenses"
            message="Something went wrong while fetching expenses."
            onRetry={() => {
              refetch();
              refetchIssued();
            }}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={
              hasActiveFilters
                ? "No records match your filters"
                : "No expenses yet"
            }
            message={
              hasActiveFilters
                ? emptyFilterMessage
                : 'Use the "Add Expense" button to record the first one.'
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            <ExpensesTable
              rows={pageRows}
              removePending={remove.isPending}
              issuedPending={
                cancelIssuedTransaction.isPending ||
                restoreIssuedTransaction.isPending
              }
              onDelete={handleDelete}
              onIssuedAction={handleIssuedAction}
            />
            <div
              className={cn(
                "mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center",
              )}
            >
              <p className="text-sm text-[var(--ink-muted)]">
                Showing {rangeStart}–{rangeEnd} of {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "record" : "records"}
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
    </div>
  );
};

export default AdminExpenses;
