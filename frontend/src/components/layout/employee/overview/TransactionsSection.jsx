import { useState, useMemo, useEffect } from "react";
import { Inbox, Layers, Search, X } from "lucide-react";
import { OVERVIEW_PAGE_SIZE } from "@/constants";
import {
  filterOverviewTransactions,
  groupTransactionsByDate,
  hasOverviewReceipt,
  sortOverviewByAdded,
  toExpenseModalRow,
} from "@/lib/overviewLedger";
import { emptyDateRange, formatDateRange } from "@/lib/utils";
import { Card } from "../../../ui/Card";
import { SearchInput } from "../../../ui/Input";
import { Pager } from "../../../ui/Pager";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import DateRangePicker from "../../../ui/DateRangePicker";
import EmployeeExpenseDetailsModal from "../expenses/EmployeeExpenseDetailsModal";
import { OverviewTable } from "./OverviewTable";
import { OverviewMobileList } from "./OverviewMobileList";
import { OverviewSheet } from "./OverviewSheet";
import { OverviewDialog } from "./OverviewDialog";

export const TransactionsSection = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  // Mobile-only detail portal: the tapped card's row.
  const [sheetRow, setSheetRow] = useState(null);
  // Desktop detail dialog: opened from the row-actions "View" menu.
  const [viewRow, setViewRow] = useState(null);
  // An expense carrying a receipt opens the full receipt UI (same
  // Overview / Receipt & Items tabs as the Expenses table) instead of the
  // plain overview dialog — the overview feed uses snake_case receipt
  // fields, so normalize to the camelCase shape the modal reads.
  const viewReceiptRow = hasOverviewReceipt(viewRow)
    ? toExpenseModalRow(viewRow)
    : null;
  // Date window applied on top of the text search (client-side; the hook
  // keeps fetching everything so clearing the range restores all rows).
  const [dateRange, setDateRange] = useState(emptyDateRange);

  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const sortedTransactions = useMemo(
    () => sortOverviewByAdded(transactions),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      filterOverviewTransactions(
        sortedTransactions,
        debouncedSearch,
        dateRange,
      ),
    [sortedTransactions, debouncedSearch, dateRange],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / OVERVIEW_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredTransactions.slice(
        currentPage * OVERVIEW_PAGE_SIZE,
        (currentPage + 1) * OVERVIEW_PAGE_SIZE,
      ),
    [filteredTransactions, currentPage],
  );

  // "Showing X–Y of N" range for the pagination footer.
  const rangeStart =
    filteredTransactions.length === 0
      ? 0
      : currentPage * OVERVIEW_PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    (currentPage + 1) * OVERVIEW_PAGE_SIZE,
    filteredTransactions.length,
  );

  const desktopEmpty = {
    title: debouncedSearch
      ? "No matching transactions"
      : hasDateRange
        ? "No transactions in this range"
        : "No transactions found",
    description: debouncedSearch
      ? hasDateRange
        ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
        : `No transactions matched "${debouncedSearch}". Try clearing your search.`
      : hasDateRange
        ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
        : "No budget issuances, expenses, abono or transfer records yet.",
  };
  const mobileEmpty = {
    title: desktopEmpty.title,
    description: debouncedSearch
      ? hasDateRange
        ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
        : `No transactions matched "${debouncedSearch}".`
      : hasDateRange
        ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
        : "No transactions recorded yet.",
  };

  return (
    <Card className="overflow-hidden px-2.5">
      {/* Header & Top Searchbar */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Layers size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
                All Transactions
              </h3>
            </div>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Every budget issuance, expense, abono and transfer
            </p>
          </div>
        </div>

        {/* Search + date filter — one row; the search field takes the room */}
        <div className="flex w-full flex-1 items-center gap-2 md:max-w-2xl">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search transactions..."
            aria-label="Search transactions"
            className="min-w-0 flex-1"
            rightSlot={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null
            }
          />
          {/* Icon-only on mobile (`compactOnMobile`), full label on `sm:`+ */}
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
      </div>
      {/* ── CONTENT: DESKTOP TABLE VIEW ── */}
      <div className="hidden md:block mt-4">
        {isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={desktopEmpty.title}
            description={desktopEmpty.description}
          />
        ) : (
          <OverviewTable rows={pageRows} onView={setViewRow} />
        )}
      </div>
      {/* ── CONTENT: MOBILE CARDS VIEW ── */}
      <div className="block md:hidden mt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-[var(--surface-2)]" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
                    <div className="h-2.5 w-20 rounded bg-[var(--surface-2)]" />
                  </div>
                </div>
                <div className="h-4 w-16 rounded bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={mobileEmpty.title}
            description={mobileEmpty.description}
          />
        ) : (
          <OverviewMobileList
            groups={groupTransactionsByDate(pageRows)}
            onOpen={setSheetRow}
          />
        )}
      </div>

      {/* Pagination — footer strip under both the table and the mobile cards:
          count on the left, pager on the right (stacked and centred on
          mobile), matching the footer used by the other tables in the app. */}
      {!isLoading && filteredTransactions.length > OVERVIEW_PAGE_SIZE && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-[var(--ink-muted)]">
            Showing {rangeStart}–{rangeEnd} of {filteredTransactions.length}{" "}
            transactions
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <OverviewSheet
        row={sheetRow}
        onClose={() => setSheetRow(null)}
        onView={(row) => {
          setSheetRow(null);
          setViewRow(row);
        }}
      />
      {viewReceiptRow ? (
        <EmployeeExpenseDetailsModal
          open
          expense={viewReceiptRow}
          onClose={() => setViewRow(null)}
        />
      ) : (
        <OverviewDialog row={viewRow} onClose={() => setViewRow(null)} />
      )}
    </Card>
  );
};

export default TransactionsSection;
