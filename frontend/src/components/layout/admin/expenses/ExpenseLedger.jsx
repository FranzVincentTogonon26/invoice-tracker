import { ReceiptText } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../../ui/DataState";
import { Pager } from "../../../ui/Pager";
import ExpensesTable from "./ExpensesTable";

export function ExpenseLedger({
  isLoading,
  error,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  emptyFilterMessage,
  pageRows,
  pending,
  onView,
  onDelete,
  onAddToDraft,
  onRemoveFromDraft,
  onCancelExpense,
  filteredRows,
  currentPage,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
}) {
  if (isLoading) return <LoadingSkeleton rows={6} />;

  if (error)
    return (
      <ErrorState
        title="Couldn't load expenses"
        message="Something went wrong while fetching expenses."
        onRetry={onRetry}
        onClearFilters={hasActiveFilters ? onClearFilters : undefined}
      />
    );

  if (pageRows.length === 0)
    return (
      <EmptyState
        icon={ReceiptText}
        title={
          hasActiveFilters ? "No records match your filters" : "No expenses yet"
        }
        message={
          hasActiveFilters
            ? emptyFilterMessage
            : 'Use the "Add Expense" button to record the first one.'
        }
        onClear={hasActiveFilters ? onClearFilters : undefined}
      />
    );

  return (
    <>
      <ExpensesTable
        rows={pageRows}
        pending={pending}
        onView={onView}
        onDelete={onDelete}
        onAddToDraft={onAddToDraft}
        onRemoveFromDraft={onRemoveFromDraft}
        onCancelExpense={onCancelExpense}
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
              onChange={onPageChange}
            />
          </div>
        )}

        <p className="text-sm text-[var(--ink-muted)] sm:ml-auto sm:mr-6">
          Total
          <span className="ml-2 text-sm font-medium text-[var(--accent-strong)] tabular-nums">
            {formatMoney(total)}
          </span>
        </p>
      </div>
    </>
  );
}

export default ExpenseLedger;
