import { ClipboardList } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../../ui/DataState";
import { Pager } from "../../../ui/Pager";
import TransactionsTable from "./TransactionsTable";

export function TransactionLedger({
  isLoading,
  error,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  hasDateRange,
  pageRows,
  pending,
  onAction,
  filteredRows,
  currentPage,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  rangeLabel,
}) {
  if (isLoading) return <LoadingSkeleton rows={6} />;

  if (error)
    return (
      <ErrorState
        title="Couldn't load transactions"
        message="Something went wrong while fetching the ledger."
        onRetry={onRetry}
        onClearFilters={hasActiveFilters ? onClearFilters : undefined}
      />
    );

  if (pageRows.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title={
          hasActiveFilters ? "No records match your filters" : "No transactions yet"
        }
        message={
          hasActiveFilters
            ? hasDateRange
              ? "Try a wider date range, another tab, or a different search term."
              : "Try another tab, filter, or search term."
            : "Records appear here as soon as budgets, expenses, abono or transfers are created."
        }
        onClear={hasActiveFilters ? onClearFilters : undefined}
      />
    );

  return (
    <>
      <TransactionsTable
        rows={pageRows}
        pending={pending}
        onAction={onAction}
      />
      <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs tabular-nums text-[var(--ink-muted)]">
          Showing{" "}
          <span className="font-medium text-[var(--ink)]">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-medium text-[var(--ink)]">
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
              onChange={onPageChange}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default TransactionLedger;
