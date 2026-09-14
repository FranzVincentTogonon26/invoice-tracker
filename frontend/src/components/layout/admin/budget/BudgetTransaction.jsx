import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { cn, formatMoney } from "../../../../lib/utils";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";

import { useBudgetTransaction } from "../../../../hooks/useBudget";
import { useAuth } from "../../../../context/AuthContext";
import {
  BUDGET_STATUS_TABS,
  PAYMENT_METHODS,
  USER_ROLES,
} from "../../../../constants";

import TransactionTable from "./TransactionTable";

// Client-side page size — the API returns the full filtered list.
const PAGE_SIZE = 100;

const METHOD_FILTER_OPTIONS = [
  { value: "all", label: "All methods" },
  ...PAYMENT_METHODS,
];

// Compact page-number window for the pager ("1 … 4 5 6 … 12").
const pageItems = (count, current) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const items = [0];
  if (current > 2) items.push("…");
  for (
    let i = Math.max(1, current - 1);
    i <= Math.min(count - 2, current + 1);
    i++
  ) {
    items.push(i);
  }
  if (current < count - 3) items.push("…");
  items.push(count - 1);
  return items;
};

const BudgetTransaction = () => {
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
  const total = useMemo(
    () => filteredRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [filteredRows],
  );

  // Reset to the first page whenever any filter changes.
  useEffect(() => setPage(0), [status, method, debouncedSearch]);

  const rangeStart =
    filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRows.length, (currentPage + 1) * PAGE_SIZE);

  // When filters are active the empty state doubles as a "clear filters" affordance.
  const hasActiveFilters =
    status !== "all" || method !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    setStatus("all");
    setMethod("all");
    setSearch("");
  };

  // Row-level mutations (approve/reject/cancel/delete) have no budget API
  // endpoints yet — the menu is fully validated per status + role via
  // `getAvailableActions` and ready to be wired to mutations here.
  const handleAction = (action, transaction) => {
    console.info(`[budget] "${action}" on transaction ${transaction.id}`);
  };

  return (
    <Card padding="md">
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
            <div className="flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-card">
              {BUDGET_STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={cn(
                    "h-8 rounded-full px-4 text-xs font-semibold transition-colors",
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
            <div className="w-[168px]">
              <Listbox
                options={METHOD_FILTER_OPTIONS}
                value={method}
                onChange={setMethod}
                placeholder="All methods"
                buttonClassName="h-9"
              />
            </div>
          </div>
          <div className="lg:ml-auto lg:w-[320px]">
            <SearchInput
              leftIcon={<Search size={16} />}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
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
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
            refetch={refetch}
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
          />
        ) : (
          <>
            <TransactionTable
              rows={pageRows}
              role={role}
              onAction={handleAction}
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
                <nav
                  aria-label="Pagination"
                  className="flex items-center gap-1"
                >
                  <PagerButton
                    label="Previous page"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </PagerButton>
                  {pageItems(pageCount, currentPage).map((item, i) =>
                    item === "…" ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-1 text-xs text-[var(--ink-muted)]"
                      >
                        …
                      </span>
                    ) : (
                      <PagerButton
                        key={item}
                        label={`Page ${item + 1}`}
                        active={item === currentPage}
                        ariaCurrent={item === currentPage}
                        onClick={() => setPage(item)}
                      >
                        {item + 1}
                      </PagerButton>
                    ),
                  )}
                  <PagerButton
                    label="Next page"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={14} />
                  </PagerButton>
                </nav>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

/* ── Local building blocks ──────────────────────────────────────────────── */

const PagerButton = ({
  label,
  children,
  active = false,
  ariaCurrent,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    aria-label={label}
    aria-current={ariaCurrent ? "page" : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors",
      active
        ? "border-transparent bg-[var(--accent-strong)] text-white"
        : "border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
      disabled && "pointer-events-none opacity-40",
    )}
  >
    {children}
  </button>
);

const LoadingSkeleton = () => (
  <div className="divide-y divide-[var(--border)]" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-2.5 w-1/4 animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div className="hidden h-4 w-20 animate-pulse rounded bg-[var(--border)] md:block" />
        <div className="hidden h-7 w-7 animate-pulse rounded-full bg-[var(--border)] md:block" />
        <div className="hidden h-9 w-9 animate-pulse rounded-full bg-[var(--border)] md:block" />
        <div className="hidden h-8 w-16 animate-pulse rounded bg-[var(--border)] md:block" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--border)]" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ hasActiveFilters, clearFilters, refetch }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
      <RotateCcw size={20} />
    </div>
    <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
      Couldn&apos;t load transactions
    </p>
    <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
      Something went wrong while fetching budget activity.
    </p>
    {hasActiveFilters ? (
      <button
        type="button"
        onClick={clearFilters}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
      >
        <RotateCcw size={12} />
        Clear filters
      </button>
    ) : (
      <button
        type="button"
        onClick={() => refetch()}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
      >
        <RotateCcw size={12} />
        Try again
      </button>
    )}
  </div>
);

const EmptyState = ({ hasActiveFilters, clearFilters }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
      <NotebookPen size={20} />
    </div>
    <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
      {hasActiveFilters
        ? "No transactions match your filters"
        : "No budget transactions yet"}
    </p>
    {hasActiveFilters ? (
      <>
        <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
          Try a different status, method or search term.
        </p>
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
        >
          <RotateCcw size={12} />
          Clear filters
        </button>
      </>
    ) : (
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
        Issued and added budget activity will appear here.
      </p>
    )}
  </div>
);

export default BudgetTransaction;
