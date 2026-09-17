import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Ban, NotebookPen, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../../ui/DataState";
import { Pager } from "../../../ui/Pager";
import { cn, formatMoney } from "../../../../lib/utils";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";

import {
  useBudgetMutations,
  useBudgetTransaction,
} from "../../../../hooks/useBudget";
import { useAuth } from "../../../../context/AuthContext";
import {
  BUDGET_STATUS_TABS,
  PAYMENT_METHODS,
  USER_ROLES,
} from "../../../../constants";

import TransactionTable from "./TransactionTable";

// Client-side page size — the API returns the full filtered list.
const PAGE_SIZE = 100;

// How long the "Undo" window stays open after a cancellation (ms). The
// backend commits the cancel immediately; while this window runs the Undo
// button can restore the transaction's previous status. Once it closes, the
// cancelled status becomes permanent.
const UNDO_WINDOW_MS = 6000;

const METHOD_FILTER_OPTIONS = [
  { value: "all", label: "All methods" },
  ...PAYMENT_METHODS,
];

const BudgetTransaction = ({ valueRemaining }) => {
  const { user } = useAuth();
  // This screen is admin-gated (`requireAdminAccess`); fall back to admin so
  // the actions menu keeps working if the role is momentarily unavailable.
  const role = user?.role ?? USER_ROLES.ADMIN;

  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  // Debounced copy of `search` so we don't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter setters — every filter change also snaps back to the first page.
  // (Event-handler reset instead of an effect; the page clamp below keeps
  // out-of-range pages safe either way.)
  const updateStatus = (key) => {
    setStatus(key);
    setPage(0);
  };
  const updateMethod = (value) => {
    setMethod(value);
    setPage(0);
  };
  const updateSearch = (value) => {
    setSearch(value);
    setPage(0);
  };

  const { data, isLoading, error, refetch } = useBudgetTransaction({
    status,
    search: debouncedSearch.trim() || undefined,
  });

  // The hook already resolves `data` to an array.
  const rows = useMemo(() => data ?? [], [data]);

  // Payment-method filtering is client-side (the API only supports `status`
  // and `search`) and runs before pagination so page counts stay accurate.
  const filteredRows = useMemo(
    () => (method === "all" ? rows : rows.filter((r) => r.method === method)),
    [rows, method],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  // Clamp so a filter change can never land on an out-of-range page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredRows, currentPage],
  );

  // Running total of the filtered list — shown in the summary footer.
  // Cancelled transactions are excluded: they no longer affect the budget,
  // so they must not count toward the total.
  const total = useMemo(
    () =>
      filteredRows.reduce(
        (sum, r) =>
          r.status === "cancelled" ? sum : sum + (Number(r.amount) || 0),
        0,
      ),
    [filteredRows],
  );

  const rangeStart =
    filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRows.length, (currentPage + 1) * PAGE_SIZE);

  // When filters are active the empty state doubles as a "clear filters" affordance.
  const hasActiveFilters =
    status !== "all" || method !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    updateStatus("all");
    updateMethod("all");
    updateSearch("");
  };

  const { cancelTransaction, restoreTransaction } = useBudgetMutations();

  // Row-level mutations route through here. `cancel` hits the backend
  // (budget.status -> 'cancelled') and opens a short undo window — undoing
  // restores the transaction's previous status before the change is treated
  // as permanent. `restore` hits the backend directly and sets the
  // transaction's status back to 'added' (budget.status -> 'added').
  const handleAction = async (action, transaction) => {
    if (action === "restore") {
      try {
        await restoreTransaction.mutateAsync({
          id: transaction.id,
          status: "added",
        });
        toast.success("Transaction restored");
      } catch (err) {
        toast.error(err?.message || "Couldn't restore transaction");
      }
      return;
    }
    if (action !== "cancel") return;
    try {
      const result = await cancelTransaction.mutateAsync(transaction.id);
      const previousStatus = result?.previousStatus ?? "added";
      toast.custom(
        (t) => (
          <CancelUndoToast
            transaction={transaction}
            visible={t.visible}
            onUndo={async () => {
              toast.dismiss(t.id);
              try {
                await restoreTransaction.mutateAsync({
                  id: transaction.id,
                  status: previousStatus,
                });
                toast.success("Cancellation undone");
              } catch (err) {
                toast.error(err?.message || "Couldn't undo cancellation");
              }
            }}
          />
        ),
        { duration: UNDO_WINDOW_MS, position: "bottom-center" },
      );
    } catch (err) {
      toast.error(err?.message || "Couldn't cancel transaction");
    }
  };

  return (
    <Card
      padding="lg"
      className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
    >
      <CardHeader>
        <div>
          <CardTitle className="text-lg">Budget Transactions</CardTitle>
          <CardDescription>Track all budget activity.</CardDescription>
        </div>
      </CardHeader>
      <div>
        {/* Search + filters — compact controls consistent with the dashboard */}
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 sm:w-fit">
              {BUDGET_STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => updateStatus(t.key)}
                  className={cn(
                    "h-7 flex-1 rounded-full px-2 text-xs font-semibold transition-colors sm:flex-none sm:px-4",
                    status === t.key
                      ? "bg-[var(--ink)] text-[var(--bg)]"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Optional payment-method filter (client-side) */}
            <div className="w-full sm:w-[168px]">
              <Listbox
                options={METHOD_FILTER_OPTIONS}
                value={method}
                onChange={updateMethod}
                placeholder="All methods"
              />
            </div>
          </div>
          <div className="lg:ml-auto lg:w-[320px]">
            <SearchInput
              leftIcon={<Search size={16} />}
              placeholder="Search..."
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => updateSearch("")}
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

        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title="Couldn't load transactions"
            message="Something went wrong while fetching budget activity."
            onRetry={refetch}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title={
              hasActiveFilters
                ? "No transactions match your filters"
                : "No budget transactions yet"
            }
            message={
              hasActiveFilters
                ? "Try a different status, method or search term."
                : "Issued and added budget activity will appear here."
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            <TransactionTable
              rows={pageRows}
              role={role}
              onAction={handleAction}
              valueRemaining={valueRemaining}
            />

            {/* Footer — "Showing X–Y of N", running total, and pagination */}
            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
              <p className="text-xs text-[var(--ink-muted)]">
                Showing {rangeStart}–{rangeEnd} of {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "transaction" : "transactions"}
              </p>
              <p className="text-xs text-[var(--ink-muted)] sm:ml-auto sm:mr-6">
                Total
                <span className="ml-2 text-sm font-semibold text-[var(--accent-strong)] tabular">
                  {formatMoney(total)}
                </span>
              </p>
              {pageCount > 1 && (
                <Pager
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

/* ── Local building blocks ──────────────────────────────────────────────── */

// Toast shown after a transaction is cancelled at the backend. Gives the
// admin an "Undo" button for the duration of the undo window (the draining
// bar tracks the remaining time); once the window closes the cancellation
// becomes permanent and the toast auto-dismisses.
const CancelUndoToast = ({ transaction, visible, onUndo }) => (
  <div
    className={cn(
      "pointer-events-auto relative flex w-[min(92vw,420px)] items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 shadow-hover transition-opacity",
      visible ? "opacity-100" : "opacity-0",
    )}
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/12 text-[var(--danger)]">
      <Ban size={16} aria-hidden />
    </div>
    <div className="min-w-0 flex-1 py-2.5">
      <p className="text-sm font-semibold text-[var(--ink)]">
        Transaction cancelled
      </p>
      <p className="truncate text-xs text-[var(--ink-muted)]">
        {transaction.description || "Budget transaction"} ·{" "}
        {formatMoney(Number(transaction.amount) || 0)} — cancelling permanently…
      </p>
    </div>
    <button
      type="button"
      onClick={onUndo}
      className="h-8 shrink-0 rounded-full bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
    >
      Undo
    </button>
    {/* Remaining-time bar — drains linearly over the undo window. */}
    <motion.div
      aria-hidden
      initial={{ width: "100%" }}
      animate={{ width: "0%" }}
      transition={{ duration: UNDO_WINDOW_MS / 1000, ease: "linear" }}
      className="absolute bottom-0 left-0 h-0.5 bg-[var(--danger)]/70"
    />
  </div>
);

export default BudgetTransaction;
