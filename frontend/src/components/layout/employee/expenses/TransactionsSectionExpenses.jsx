import { useState, useMemo, useEffect } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  Search,
  X,
  Inbox,
  Wallet,
  ReceiptText,
  HandCoins,
  Wallet as MethodWalletIcon,
} from "lucide-react";
import { Card } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
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

// Short "20 Oct" date for the compact mobile meta row. Falls back to the
// full `formatDate` for valid non-midnight timestamps only when parsing
// fails entirely — invalid dates render as "—", never "Invalid Date".
const formatShortDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const TYPE_LABEL_SHORT = {
  issued: "Received",
  expense: "Spent",
};

// Instant-scan method badge: tint + glyph per payment method so the type is
// readable without parsing text. Unknown methods fall back to neutral.
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
      className={cn("shrink-0 px-1.5 py-0.5 text-[10px]", className)}
    >
      <BadgeIcon size={11} aria-hidden />
      {methodLabel(method)}
    </Badge>
  );
};

const TYPE_CONFIG = {
  issued: {
    label: "Received",
    badgeTone: "accent",
    icon: Wallet,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  expense: {
    label: "Paid",
    badgeTone: "neutral",
    icon: ReceiptText,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  abono: {
    label: "Abono",
    badgeTone: "warning",
    icon: HandCoins,
    iconWrapperClass: "bg-[var(--warning)]/15 text-[var(--warning)]",
  },
};

const PAGE_SIZE = 10;
const COLUMN_WIDTHS = ["16%", "28%", "18%", "16%", "22%"];

export const TransactionsSectionExpenses = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
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

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const { start, end } = dateRange ?? {};
    const inRange = (tx) => matchesDayRange(tx.date, start, end);
    if (!q) return transactions.filter(inRange);
    return transactions.filter((tx) => {
      if (!inRange(tx)) return false;
      const typeLabel = TYPE_CONFIG[tx.kind]?.label?.toLowerCase() || "";
      const desc = (tx.description || "").toLowerCase();
      const refLabel = (tx.reference_label || "").toLowerCase();
      const notes = (tx.notes || "").toLowerCase();
      const method = methodLabel(tx.method || "").toLowerCase();
      const status = (tx.status || "").toLowerCase();
      const amountStr = String(tx.amount || "");

      return (
        desc.includes(q) ||
        refLabel.includes(q) ||
        notes.includes(q) ||
        typeLabel.includes(q) ||
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
  return (
    <Card className="overflow-hidden">
      {/* Header & Top Searchbar */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Layers size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold tracking-tight text-[var(--ink)]">
                All Expenses
              </h3>
            </div>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Monitor spending and expenses.
            </p>
          </div>
        </div>

        {/* Search + date filter — one row; the search field takes the room */}
        <div className="flex w-full flex-1 items-center gap-2 md:max-w-2xl">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search..."
            aria-label="Search Expenses"
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
            title={
              debouncedSearch
                ? "No matching transactions"
                : hasDateRange
                  ? "No transactions in this range"
                  : "No transactions found"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No transactions matched "${debouncedSearch}". Try clearing your search.`
                    : "No budget issuances, expenses, or abono records yet."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
              <caption className="sr-only">
                Employee all transactions list
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
                    Method
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Type
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageRows.map((tx) => {
                  const meta = TYPE_CONFIG[tx.kind] ?? TYPE_CONFIG.expense;
                  const Icon = meta.icon;
                  const isNegative = tx.kind === "expense";
                  const amountColor = isNegative
                    ? "text-[var(--danger)]"
                    : tx.kind === "issued"
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--ink)]";

                  return (
                    <tr
                      key={`${tx.kind}-${tx.id}`}
                      className="transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]"
                    >
                      <td className="px-4 py-3 first:pl-5 align-middle">
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
                          title={tx.reference_label || tx.description}
                        >
                          {tx.reference_label || tx.description || "—"}
                        </p>
                        {tx.reference_label && tx.description ? (
                          <p
                            className="mt-0.5 truncate text-[11px] leading-snug text-[var(--ink-muted)]"
                            title={tx.description}
                          >
                            {tx.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <MethodBadge
                          method={tx.method}
                          className="max-w-full"
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge
                          tone={meta.badgeTone}
                          className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
                        >
                          <Icon
                            size={12}
                            strokeWidth={2.2}
                            className="shrink-0"
                          />
                          <span className="truncate">{meta.label}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right last:pr-5 align-middle">
                        <span
                          className={cn(
                            "whitespace-nowrap font-display text-[15px] font-semibold tabular-nums",
                            amountColor,
                          )}
                        >
                          {isNegative
                            ? `-${formatMoney(tx.amount)}`
                            : `+${formatMoney(tx.amount)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── CONTENT: MOBILE CARDS VIEW ── */}
      <div className="block md:hidden mt-4 space-y-2.5">
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
            title={
              debouncedSearch
                ? "No matching transactions"
                : hasDateRange
                  ? "No transactions in this range"
                  : "No transactions found"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No transactions matched "${debouncedSearch}".`
                    : "No transactions recorded yet."
            }
          />
        ) : (
          pageRows.map((tx) => {
            const meta = TYPE_CONFIG[tx.kind] ?? TYPE_CONFIG.expense;
            const Icon = meta.icon;
            const isNegative = tx.kind === "expense";
            const amountColor = isNegative
              ? "text-[var(--danger)]"
              : tx.kind === "issued"
                ? "text-[var(--accent-strong)]"
                : "text-[var(--ink)]";

            return (
              <div
                key={`${tx.kind}-${tx.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3.5 transition-shadow hover:shadow-card"
              >
                {/* Left: Icon & Details matching requested mobile structure */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      meta.iconWrapperClass,
                    )}
                  >
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold leading-none text-[var(--ink)]">
                      {tx.description || meta.label}
                    </p>
                    {/* Meta row: type · short date · method badge */}
                    <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
                      <span className="shrink-0">
                        {TYPE_LABEL_SHORT[tx.kind] ?? meta.label}
                      </span>
                      <span aria-hidden className="shrink-0 opacity-40">
                        |
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatShortDate(tx.date)}
                      </span>
                      <span aria-hidden className="shrink-0 opacity-40">
                        |
                      </span>
                      <MethodBadge method={tx.method} />
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Status */}
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "font-display text-base font-semibold tabular-nums",
                      amountColor,
                    )}
                  >
                    {isNegative
                      ? `-${formatMoney(tx.amount)}`
                      : `+${formatMoney(tx.amount)}`}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!isLoading && filteredTransactions.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--ink-muted)] tabular-nums">
            Showing {currentPage * PAGE_SIZE + 1}–
            {Math.min(
              (currentPage + 1) * PAGE_SIZE,
              filteredTransactions.length,
            )}{" "}
            of {filteredTransactions.length} transactions
          </p>
          <Pager
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </div>
      )}
    </Card>
  );
};

export default TransactionsSectionExpenses;
