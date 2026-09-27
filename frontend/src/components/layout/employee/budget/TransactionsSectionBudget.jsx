import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  CreditCard,
  Eye,
  Landmark,
  Layers,
  Search,
  Wallet,
  Wallet as MethodWalletIcon,
  X,
  Inbox,
} from "lucide-react";
import { Card } from "../../../ui/Card";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { SearchInput } from "../../../ui/Input";
import { Pager } from "../../../ui/Pager";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import {
  cn,
  emptyDateRange,
  formatDate,
  formatDateRange,
  formatMoney,
  formatTime,
  matchesDayRange,
  methodLabel,
  toDate,
} from "../../../../lib/utils";
import DateRangePicker from "../../../ui/DateRangePicker";
import { useLockBody } from "../../../../hooks/useLockBody";

/**
 * Employee "My Budget" ledger — every `issued_budget` row the employee
 * received (joined through their own `budget_issued_reference`), scoped
 * server-side to the signed-in user. Read-only: issuing/cancelling budgets
 * stays an admin action, so rows only open the details sheet/modal — no
 * delete actions anywhere in this section.
 *
 * UI mirrors TransactionsSectionExpenses: same mobile card → bottom-sheet
 * slide-up, desktop table → centered details modal, same search, date range
 * and pager.
 */

const formatShortDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const METHOD_BADGE = {
  cash: { tone: "success", icon: Banknote },
  bank_transfer: { tone: "accent", icon: Landmark },
  e_wallet: { tone: "warning", icon: MethodWalletIcon },
};

const MethodBadge = ({ method, className }) => {
  const config = METHOD_BADGE[method] ?? { tone: "neutral", icon: CreditCard };
  const BadgeIcon = config.icon;
  return (
    <Badge
      tone={config.tone}
      className={cn("shrink-0 px-2 py-1 text-[12px]", className)}
    >
      <BadgeIcon size={16} aria-hidden />
      {methodLabel(method)}
    </Badge>
  );
};

const ISSUED_META = {
  label: "Issued",
  icon: Wallet,
  iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
};

const SHEET_EASE = [0.16, 1, 0.3, 1];
const DIALOG_EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 50;
// Date | Description | Source of Funds | Method | Status | Amount | Actions
const COLUMN_WIDTHS = ["14%", "24%", "16%", "14%", "12%", "14%", "6%"];

// The row's recorded facts — shared by the mobile bottom sheet and the
// desktop details modal so both surfaces always read identically.
const IssuedDetailsBody = ({ row }) => {
  const status = row?.status ?? "open";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
            {formatMoney(row?.amount)}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
            {[row?.source_of_funds, methodLabel(row?.method)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusBadge status={status} className="shrink-0" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
          <p className="type-eyebrow text-[var(--ink-muted)]">Date issued</p>
          <p className="mt-1 truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatDate(row?.date)}
            {row?.date ? ` · ${formatTime(row.date)}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
          <p className="type-eyebrow text-[var(--ink-muted)]">Cut-off date</p>
          <p className="mt-1 truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
            {row?.date_cut_off ? formatDate(row.date_cut_off) : "—"}
          </p>
        </div>
      </div>

      {row?.description && (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3 text-sm font-medium leading-snug text-[var(--ink)]">
          {row.description}
        </p>
      )}

      {row?.notes && (
        <p className="rounded-2xl border-l-2 border-[var(--accent)]/40 bg-[var(--surface-2)]/50 px-4 py-3 text-sm italic leading-relaxed text-[var(--ink-muted)]">
          {row.notes}
        </p>
      )}
    </div>
  );
};

function TransactionCard({ tx, onOpen }) {
  const Icon = ISSUED_META.icon;

  return (
    <div
      onClick={() => onOpen?.()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest("button")) return;
        e.preventDefault();
        onOpen?.();
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${tx.description || "issued budget"}`}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 py-3 transition-shadow hover:shadow-card active:scale-[0.99]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            ISSUED_META.iconWrapperClass,
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-none text-[var(--ink)]">
            {tx.description || "Issued budget"}
          </p>
          <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
            <span className="shrink-0 tabular-nums">
              {formatShortDate(tx.date)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="truncate text-[10px] type-eyebrow">
              {tx.source_of_funds || methodLabel(tx.method)}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-right font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(tx.amount)}
        </p>
        <StatusBadge status={tx.status ?? "open"} className="px-1.5 py-0.5" />
      </div>
    </div>
  );
}

/* ── Mobile bottom sheet — same slide-up animation as the expenses sheet ── */
function TransactionSheet({ row, onClose }) {
  const sheetRef = useRef(null);
  // Lock is tied purely to `row` so it can never leak (see the expenses
  // sheet): engage on open, release the instant the row clears. No
  // `.focus()` — focusing the dialog scrolled the page to the top on mobile.
  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!row) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [row, close]);



  const title = row?.description || "Issued budget";

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="issued-sheet"
          className="fixed inset-0 z-[70] flex flex-col justify-end md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: SHEET_EASE }}
            className={cn(
              "scrollbar-slim relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain outline-none",
              "rounded-t-[15px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover will-change-transform",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <div
              aria-hidden
              className="mx-auto h-1.5 w-10 rounded-full bg-[var(--ink-muted)]/25"
            />
            <div className="flex items-center gap-3 pt-4">
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  ISSUED_META.iconWrapperClass,
                )}
              >
                <ISSUED_META.icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold tracking-tight text-[var(--ink)]">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatDate(row?.date)}
                  {row?.date ? ` · ${formatTime(row.date)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close budget preview"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <IssuedDetailsBody row={row} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Desktop details modal — same dialog animation as the expense modal ── */
function BudgetDetailsModal({ row, onClose }) {
  const titleRef = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!row) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [row, close]);

  useLockBody(Boolean(row));

  const title = row?.description || "Issued budget";

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="issued-details-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] hidden items-center justify-center bg-[var(--ink)]/35 p-3 backdrop-blur-md sm:p-4 md:flex"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Issued budget details"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.24, ease: DIALOG_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    ISSUED_META.iconWrapperClass,
                  )}
                >
                  <ISSUED_META.icon size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    ref={titleRef}
                    className="font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                  >
                    Issued budget details
                  </h3>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                    {formatDate(row?.date)}
                    {row?.date ? ` · ${formatTime(row.date)}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close budget details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <IssuedDetailsBody row={row} />
              <p className="sr-only">{title}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export const TransactionsSectionBudget = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const [sheetRow, setSheetRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const { start, end } = dateRange ?? {};
    const inRange = (tx) => matchesDayRange(tx.date, start, end);
    if (!q) return transactions.filter(inRange);

    return transactions.filter((tx) => {
      if (!inRange(tx)) return false;
      const desc = (tx.description || "").toLowerCase();
      const source = (tx.source_of_funds || "").toLowerCase();
      const notes = (tx.notes || "").toLowerCase();
      const method = methodLabel(tx.method || "").toLowerCase();
      const status = (tx.status || "").toLowerCase();
      const amountStr = String(tx.amount || "");

      return (
        desc.includes(q) ||
        source.includes(q) ||
        notes.includes(q) ||
        method.includes(q) ||
        status.includes(q) ||
        amountStr.includes(q)
      );
    });
  }, [transactions, debouncedSearch, dateRange]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredTransactions.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredTransactions, currentPage],
  );

  const rangeStart =
    filteredTransactions.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    filteredTransactions.length,
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Layers size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold tracking-tight text-[var(--ink)]">
                Budget Issued
              </h3>
            </div>
            <p className="truncate text-xs text-[var(--ink-muted)]">
              Every budget your admin issued to you.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-1 items-center gap-2 md:max-w-2xl">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search..."
            aria-label="Search issued budgets"
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


      {/* ── Desktop: table (mirrors the expenses ledger) ── */}
      <div className="mt-4 hidden md:block">
        {isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              debouncedSearch
                ? "No matching issuances"
                : hasDateRange
                  ? "No issuances in this range"
                  : "No budget issued yet"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `No budget was issued in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No issuances matched "${debouncedSearch}". Try clearing your search.`
                    : "Budgets your admin issues will appear here."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
              <caption className="sr-only">
                Employee issued budget list
              </caption>
              <colgroup>
                {COLUMN_WIDTHS.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]">
                <tr>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-5">
                    Date
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Description
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Source of Funds
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Payment Method
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                    Amount
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageRows.map((tx) => (
                  <tr
                    key={`${tx.kind}-${tx.id}`}
                    className="transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]"
                  >
                    <td className="px-4 py-3 align-middle first:pl-5">
                      <p className="whitespace-nowrap text-[13px] font-semibold leading-none tabular-nums text-[var(--ink)]">
                        {formatDate(tx.date)}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--ink-muted)]">
                        {formatTime(tx.date)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p
                        className="truncate text-[13px] font-semibold leading-snug text-[var(--ink)]"
                        title={tx.description || "Issued budget"}
                      >
                        {tx.description || "Issued budget"}
                      </p>
                      {tx.notes && (
                        <p
                          className="mt-0.5 truncate text-[11px] leading-snug text-[var(--ink-muted)]"
                          title={tx.notes}
                        >
                          {tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge tone="accent" className="max-w-full">
                        <span className="truncate">
                          {tx.source_of_funds || "—"}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <MethodBadge method={tx.method} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge status={tx.status ?? "open"} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <span className="text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle last:pr-5">
                      <button
                        type="button"
                        onClick={() => setDetailRow(tx)}
                        aria-label={`View details for ${tx.description || "issued budget"}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                      >
                        <Eye size={16} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>



      {/* ── Mobile: cards (mirrors the expenses ledger) ── */}
      <div className="mt-4 block space-y-2.5 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5"
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
          ))
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              debouncedSearch
                ? "No matching issuances"
                : hasDateRange
                  ? "No issuances in this range"
                  : "No budget issued yet"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `No budget was issued in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No issuances matched "${debouncedSearch}".`
                    : "Budgets your admin issues will appear here."
            }
          />
        ) : (
          pageRows.map((tx) => (
            <TransactionCard
              key={`${tx.kind}-${tx.id}`}
              tx={tx}
              onOpen={() => setSheetRow(tx)}
            />
          ))
        )}
      </div>

      {!isLoading && filteredTransactions.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-[var(--ink-muted)]">
            Showing {rangeStart}–{rangeEnd} of {filteredTransactions.length}{" "}
            issuances
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <TransactionSheet row={sheetRow} onClose={() => setSheetRow(null)} />
      <BudgetDetailsModal row={detailRow} onClose={() => setDetailRow(null)} />
    </Card>
  );
};

export default TransactionsSectionBudget;
