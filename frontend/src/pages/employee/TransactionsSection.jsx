import { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Search,
  X,
  Inbox,
  Wallet,
  ReceiptText,
  HandCoins,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { SearchInput } from "../../components/ui/Input";
import { MethodIcon } from "../../components/ui/Select";
import { Pager } from "../../components/ui/Pager";
import { EmptyState, LoadingSkeleton } from "../../components/ui/DataState";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../lib/utils";

const TYPE_CONFIG = {
  issued: {
    label: "Budget Issued",
    badgeTone: "accent",
    icon: Wallet,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
  expense: {
    label: "Expense",
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

const EXPENSE_STATUS_TONES = {
  paid: "success",
  draft: "warning",
  cancel: "danger",
};

const ABONO_STATUS_TONES = {
  open: "warning",
  settled: "success",
};

const PAGE_SIZE = 10;
const COLUMN_WIDTHS = ["14%", "15%", "23%", "16%", "12%", "10%", "10%"];

export const TransactionsSection = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((tx) => {
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
  }, [transactions, debouncedSearch]);

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
                All Transactions
              </h3>
              {!isLoading && (
                <Badge tone="neutral" className="tabular-nums">
                  {filteredTransactions.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Every budget issuance, expense and abono reimbursement
            </p>
          </div>
        </div>

        {/* Top Searchbar */}
        <div className="w-full md:w-80">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search transactions..."
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
                : "No transactions found"
            }
            description={
              debouncedSearch
                ? `No transactions matched "${debouncedSearch}". Try clearing your search.`
                : "No budget issuances, expenses, or abono records yet."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                Employee all transactions list
              </caption>
              <colgroup>
                {COLUMN_WIDTHS.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]/80 backdrop-blur">
                <tr>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)] first:pl-5">
                    Date
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)]">
                    Type
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)]">
                    Description
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)]">
                    Reference
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)]">
                    Method
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 text-center type-eyebrow text-[var(--ink-muted)]">
                    Status
                  </th>
                  <th className="border-b border-[var(--border)] px-4 py-3.5 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
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
                      className="group transition-colors duration-150 hover:bg-[var(--accent)]/[0.04]"
                    >
                      <td className="px-4 py-3.5 first:pl-5 align-middle">
                        <p className="text-sm font-medium leading-none tabular-nums text-[var(--ink)]">
                          {formatDate(tx.date)}
                        </p>
                        <p className="mt-1 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
                          {formatTime(tx.date)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Badge
                          tone={meta.badgeTone}
                          className="max-w-full gap-1.5"
                        >
                          <Icon
                            size={12}
                            strokeWidth={2.2}
                            className="shrink-0"
                          />
                          <span className="truncate">{meta.label}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <p
                          className="truncate text-sm font-semibold text-[var(--ink)]"
                          title={tx.description}
                        >
                          {tx.description || "—"}
                        </p>
                        {tx.notes && (
                          <p
                            className="mt-0.5 truncate text-xs text-[var(--ink-muted)]"
                            title={tx.notes}
                          >
                            {tx.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <p className="truncate text-xs font-medium text-[var(--ink-muted)]">
                          {tx.reference_label || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                          <MethodIcon
                            method={tx.method}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          <span className="truncate capitalize">
                            {methodLabel(tx.method)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle">
                        {tx.kind === "issued" ? (
                          <StatusBadge status={tx.status} />
                        ) : tx.kind === "expense" ? (
                          <Badge
                            tone={EXPENSE_STATUS_TONES[tx.status] ?? "neutral"}
                            className="capitalize"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {tx.status || "—"}
                          </Badge>
                        ) : (
                          <Badge
                            tone={ABONO_STATUS_TONES[tx.status] ?? "neutral"}
                            className="capitalize"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {tx.status || "open"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right last:pr-5 align-middle">
                        <span
                          className={cn(
                            "font-display text-sm font-semibold tabular-nums",
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
                : "No transactions found"
            }
            description={
              debouncedSearch
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
                    <p className="mt-1 truncate text-[11px] font-medium leading-none text-[var(--ink-muted)]">
                      {meta.label} · {formatDate(tx.date)}{" "}
                      {tx.reference_label ? `· ${tx.reference_label}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Status */}
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "font-display text-sm font-semibold tabular-nums",
                      amountColor,
                    )}
                  >
                    {isNegative
                      ? `-${formatMoney(tx.amount)}`
                      : `+${formatMoney(tx.amount)}`}
                  </p>
                  <div className="mt-1 flex justify-end">
                    {tx.kind === "issued" ? (
                      <StatusBadge
                        status={tx.status}
                        className="text-[10px] px-1.5 py-0.5"
                      />
                    ) : tx.kind === "expense" ? (
                      <Badge
                        tone={EXPENSE_STATUS_TONES[tx.status] ?? "neutral"}
                        className="capitalize text-[10px] px-1.5 py-0.5"
                      >
                        {tx.status || "—"}
                      </Badge>
                    ) : (
                      <Badge
                        tone={ABONO_STATUS_TONES[tx.status] ?? "neutral"}
                        className="capitalize text-[10px] px-1.5 py-0.5"
                      >
                        {tx.status || "open"}
                      </Badge>
                    )}
                  </div>
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

export default TransactionsSection;
