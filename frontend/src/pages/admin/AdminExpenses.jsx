import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
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
import {
  cn,
  formatMoney,
  monthRange,
  startOfDay,
  toISODate,
} from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
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

// Status values across both ledger sources — expenses (paid/draft/cancel) and
// budget issuances (open/close/cancel) — so one dropdown can filter both.
const STATUS_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "close", label: "Closed (issued)" },
  { value: "cancel", label: "Cancelled" },
];

const matchesDayRange = (iso, start, end) => {
  if (!iso) return true;
  const day = startOfDay(new Date(`${iso}T00:00:00`));
  if (!day) return true;
  if (start && day < startOfDay(start)) return false;
  if (end && day > startOfDay(end)) return false;
  return true;
};

const AdminExpenses = () => {
  const nav = useNavigate();
  const [dateRange, setDateRange] = useState(() => monthRange());
  const { data, expenses, categories, isLoading, error, refetch } = useExpenses(
    {
      from: dateRange?.start ? toISODate(dateRange.start) : undefined,
      to: dateRange?.end ? toISODate(dateRange.end) : undefined,
    },
  );
  const { remove } = useExpensesMutations();
  const { cancelIssuedTransaction, restoreIssuedTransaction } =
    useBudgetMutations();
  const queryClient = useQueryClient();

  // Budget issuances (issued_budget ⨝ budget_issued_reference ⨝ users) — the
  // "Budget Issued" lines of the ledger, fetched from the budget API.
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overview = data?.overview ?? {};
  const totalBudget = Number(overview.totalBudget ?? 0);
  const totalIssued = Number(overview.totalIssued ?? 0);
  const totalExpenses = Number(overview.totalExpenses ?? 0);
  const cashOnHand = totalBudget - (totalIssued + totalExpenses);

  const rangedExpenses = useMemo(
    () =>
      (expenses ?? []).filter((e) =>
        matchesDayRange(e.expense_date, dateRange?.start, dateRange?.end),
      ),
    [expenses, dateRange],
  );

  // Issued-budget lines scoped to the same date range (issue date =
  // issued_budget.created_at), mapped into the ledger row shape.
  const rangedIssued = useMemo(
    () =>
      (issuedTransactions ?? [])
        .filter((t) =>
          matchesDayRange(t.date_issued, dateRange?.start, dateRange?.end),
        )
        .map((t) => ({
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
    [issuedTransactions, dateRange],
  );

  // Unified ledger: every expense is "Expense", every issuance "Budget Issued".
  const ledgerRows = useMemo(
    () =>
      [
        ...rangedExpenses.map((e) => ({
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
        ...rangedIssued,
      ].sort((a, b) => {
        const ta = new Date(a.timeDate ?? a.date ?? 0).getTime() || 0;
        const tb = new Date(b.timeDate ?? b.date ?? 0).getTime() || 0;
        return tb - ta;
      }),
    [rangedExpenses, rangedIssued],
  );

  const rangedTotal = useMemo(
    () =>
      rangedExpenses.reduce(
        (sum, e) =>
          e.status === "cancel" ? sum : sum + (Number(e.total_amount) || 0),
        0,
      ),
    [rangedExpenses],
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

  const methodOptions = useMemo(
    () => [{ value: "all", label: "All methods" }, ...PAYMENT_METHODS],
    [], // PAYMENT_METHODS is a module constant — never changes
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
      // Issuance rows have no category — they stay visible under
      // "All categories" only (the kind guard above handles that).

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
    category !== "all" ||
    method !== "all" ||
    status !== "all" ||
    search.trim().length > 0;
  const clearFilters = () => {
    setCategory("all");
    setMethod("all");
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  // Export the currently filtered ledger (not just the visible page) to CSV.
  // Quotes every value and escapes embedded quotes so commas/newlines in
  // descriptions can't break the file; BOM keeps Excel happy with UTF-8.
  const handleExport = () => {
    const header = [
      "Date",
      "Type",
      "Description",
      "Category",
      "Amount",
      "Employee",
      "Method",
      "Status",
    ];
    const methodLabelOf = (m) =>
      PAYMENT_METHODS.find((p) => p.value === m)?.label ?? (m || "—");
    const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...filteredRows.map((r) =>
        [
          r.date || "",
          r.kind === "issued" ? "Budget Issued" : "Expense",
          r.description || "Untitled expense",
          r.category || "Uncategorized",
          (Number(r.amount) || 0).toFixed(2),
          r.employee || "—",
          methodLabelOf(r.method),
          r.status || "—",
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const from = dateRange?.start ? toISODate(dateRange.start) : "all";
    const to = dateRange?.end ? toISODate(dateRange.end) : "time";
    link.href = url;
    link.download = `expenses_${from}_to_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${filteredRows.length} ${filteredRows.length === 1 ? "record" : "records"}`,
    );
  };

  const handleDelete = async (id) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Expense removed");
    } catch (err) {
      toast.error(err?.message || "Couldn't delete expense");
    }
  };

  // Issued-transaction actions (burger menu on "Budget Issued" rows):
  //   - cancel  → budget_issued_reference.status -> 'cancel'
  //   - restore → back to its previous status ('open')
  // The Expenses overview (Total Issued Budget / My Balance cards) is served
  // from the ["expenses"] cache, so it is invalidated after every mutation.
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
        description="Track every peso you spend. Filter by date or category, then drill into each line."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <DateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(0);
              }}
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
              value={formatMoney(rangedTotal)}
              icon={ReceiptText}
              loading={isLoading}
              accent
              breakdownCaption="Across the selected range"
            />
          </motion.div>
          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="My Balance"
              value={formatMoney(cashOnHand)}
              icon={Wallet}
              loading={isLoading}
              tone={cashOnHand < 0 ? "danger" : undefined}
              breakdownCaption={null}
            />
          </motion.div>
          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Issued Budget"
              value={formatMoney(totalIssued)}
              icon={HandCoins}
              loading={isLoading}
              breakdownCaption={null}
            />
          </motion.div>
          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Transactions"
              value={rangedExpenses.length}
              icon={ClipboardList}
              loading={isLoading}
              breakdownCaption={null}
            />
          </motion.div>
        </motion.div>
      </section>
      <Card
        padding="lg"
        className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
      >
        <CardHeader>
          <div>
            <CardTitle className="text-lg">All Expenses</CardTitle>
            <CardDescription className="text-sm">
              Every expense and budget issuance in the selected range.
            </CardDescription>
          </div>
          <Button
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            aria-label="Export filtered expenses to CSV"
          >
            <Download size={15} /> Export CSV
          </Button>
        </CardHeader>
        <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
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
          <div className="w-full lg:flex-1">
            <SearchInput
              leftIcon={<Search size={16} />}
              placeholder="Search by description, category, or spender..."
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
                ? "Try a different category or search term."
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
