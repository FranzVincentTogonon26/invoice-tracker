import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Flag,
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
  isSameDay,
  matchesDayRange,
  methodLabel,
  startOfDay,
  toDate,
  addDays,
} from "../../../../lib/utils";
import DateRangePicker from "../../../ui/DateRangePicker";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";

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
  abono: "Abono",
  transfer: "Transfer",
};

// Mobile OverviewSheet header label per kind — the sheet titles itself by the
// item's TYPE (matching the TYPE_LABEL_SHORT wording above: Received -> Budget,
// Spent -> Expenses, Abono -> Abono, Transfer -> Transfer) instead of echoing
// the row's description, which already renders in the details body's
// Description row.
const TYPE_ITEM_TITLE = {
  issued: "Budget",
  expense: "Expenses",
  abono: "Abono",
  transfer: "Transfer",
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
      className={cn("shrink-0 px-2 py-1 text-[12px]", className)}
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
  // Budget transfers are identified by the ArrowLeftRight glyph everywhere in
  // this ledger (table badge, mobile meta, sheet). Direction splits the
  // reading: sent money leaves the pool (−, danger), received money widens it
  // (+, accent) — the same sign convention the budget ledger uses.
  transfer: {
    label: "Transfer",
    badgeTone: "accent",
    icon: ArrowLeftRight,
    iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  },
};

const PAGE_SIZE = 50;

const SHEET_EASE = [0.16, 1, 0.3, 1];

// `expenses.flag = 1` means the backend saved this employee line as backdated
// (dated before the first budget issued to them). Accepts both the raw `flag`
// column and the mapped `flagged` boolean so desktop + mobile render from any
// shape the overview passes in. Only `expense` rows can ever be flagged —
// issued/abono always carry `flag = 0`.
const isFlagged = (row) => row?.flagged === true || Number(row?.flag) === 1;

// Budget-transfer rows (kind "transfer", success only): `direction` is 'sent'
// (this employee moved money out) or 'received' (money moved in). Only
// `expense` and sent-transfer rows can ever read negative — issued/abono and
// received transfers always carry `flag = 0` too.
const isTransfer = (row) => row?.kind === "transfer";
const isSentTransfer = (row) => isTransfer(row) && row?.direction === "sent";
const isNegative = (row) => row?.kind === "expense" || isSentTransfer(row);

// "To <name>" / "From <name>" second line for transfer rows.
const transferCounterparty = (row) =>
  isTransfer(row) && row?.counterparty
    ? `${isSentTransfer(row) ? "To" : "From"} ${row.counterparty}`
    : "";

// Expense rows the ledger labels with their OWN status badge: a soft-deleted
// row is parked in 'draft' and a voided one sits in 'cancel' (see the row
// actions). Paid rows keep the plain type badge, and issued/abono rows have
// their own badges — only these two statuses get an identifying badge.
const isDraftOrCancelled = (row) =>
  row?.kind === "expense" &&
  (row?.status === "draft" || row?.status === "cancel");

// A cancelled row never counts toward any total — strike its amount so it
// reads as void at a glance.
const isCancelled = (row) =>
  row?.kind === "expense" && row?.status === "cancel";

// A cancelled issuance no longer funds the employee — mark it with a danger
// "Cancelled" badge and strike its amount, but leave every tone alone: row,
// badge family and amount color stay exactly as a live row renders.
const isCancelledIssued = (row) =>
  row?.kind === "issued" && row?.status === "cancel";

// Draft expenses read warning-toned; cancelled rows danger-toned — the same
// status colors their badges use, so the row and badge speak one language.
const isDraftExpense = (row) =>
  row?.kind === "expense" && row?.status === "draft";

/* ── Mobile detail sheet body — amount hero + summary rows per kind ── */
// Mirrors the budget ledger's IssuedDetailsBody: one amount hero on top,
// then type-specific summaries below. Read-only — overview never edits.
const OverviewDetailsBody = ({ row, meta }) => {
  const flagged = isFlagged(row);
  const kind = row?.kind;
  const transfer = isTransfer(row);
  const sent = isSentTransfer(row);
  const counterparty = transferCounterparty(row);
  const sign = isNegative(row) ? "-" : "+";
  const statusBadge =
    kind === "issued" ? (
      row?.status === "cancel" ? (
        <Badge tone="danger">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Cancelled
        </Badge>
      ) : (
        <Badge tone="success">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Received
        </Badge>
      )
    ) : kind === "abono" ? (
      // A settled abono is closed out (reimbursed) — accent tone + explicit
      // "Settled Abono" wording so it never reads like live money.
      row?.status === "settled" ? (
        <Badge tone="accent">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Settled Abono
        </Badge>
      ) : (
        <Badge tone="warning">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Abono
        </Badge>
      )
    ) : transfer ? (
      <Badge tone={sent ? "neutral" : "success"}>
        <ArrowLeftRight size={12} aria-hidden className="shrink-0" />
        {sent ? "Sent" : "Received"}
      </Badge>
    ) : isDraftOrCancelled(row) ? (
      // Only draft / cancelled expenses add a status badge here — a paid row
      // keeps the plain "Paid" pill it always had.
      <ExpenseStatusBadge status={row.status} />
    ) : (
      <Badge tone="neutral">
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        Paid
      </Badge>
    );
  const summaryLabel =
    kind === "issued"
      ? "Received"
      : kind === "abono"
        ? "Abono"
        : transfer
          ? counterparty || "Transfer"
          : "Spent";
  return (
    <div className="mt-4 space-y-3">
      {flagged && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/[0.1] px-4 py-3"
        >
          <Flag
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--warning)]"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--warning)]">
              Flagged for review
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--warning)]/90">
              Dated before the first budget issued to you — an admin needs to
              approve it.
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]",
              isCancelledIssued(row) && "line-through",
            )}
          >
            {sign}
            {formatMoney(row?.amount)}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
            {[summaryLabel, methodLabel(row?.method)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {statusBadge}
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="border-b border-[var(--border)] py-3 first:pt-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Description</p>
          <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)] normal-case">
            {row?.description || meta?.label || "—"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 py-1">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Date</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatDate(row?.date)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Time</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatTime(row?.date)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Method</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
              {methodLabel(row?.method)}
            </p>
          </div>
        </div>
        {/* Transfer rows read who the money moved to / came from, plus the
            sender's notes when the description shows them. */}
        {transfer && (counterparty || row?.notes) ? (
          <div className="grid gap-3 border-t border-[var(--border)] pt-3 py-1">
            {counterparty && (
              <div className="min-w-0">
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  {sent ? "Sent to" : "Received from"}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                  {row.counterparty}
                </p>
              </div>
            )}
          </div>
        ) : null}
        {kind === "abono" && row?.status === "settled" && row?.date_settled ? (
          <div className="grid grid-cols-3 border-t border-[var(--border)] pt-3 py-1">
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                Date Settled
              </p>
              <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                {formatDate(row?.date_settled)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">Time</p>
              <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                {formatTime(row?.date_settled)}
              </p>
            </div>
          </div>
        ) : null}
        {/* Cancelled expenses read their own (void/remarks) note on this row —
            other kinds carry no expense note. */}
        {kind === "expense" && row?.status === "cancel" ? (
          <div className="grid border-t border-[var(--border)] pt-3 py-1">
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">Notes</p>
              <p className="mt-1  text-sm font-medium tabular-nums text-[var(--ink)]">
                {row?.notes || "—"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

function getDateGroupLabel(date) {
  const txDate = startOfDay(toDate(date));
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  if (isSameDay(txDate, today)) return "Today";
  if (isSameDay(txDate, yesterday)) return "Yesterday";
  return "Last days";
}

function groupTransactionsByDate(rows) {
  const groups = new Map();
  const groupOrder = ["Today", "Yesterday", "Last days"];

  for (const tx of rows) {
    const label = getDateGroupLabel(tx.date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(tx);
  }

  return groupOrder
    .filter((label) => groups.has(label) && groups.get(label).length > 0)
    .map((label) => ({ label, transactions: groups.get(label) }));
}

/* ── Mobile bottom sheet — same slide-up as the budget sheet ── */
// Mobile-only (md:hidden): tapping a card opens this portal with the
// tapped row's details + summary. Desktop keeps the plain table.
function OverviewSheet({ row, onClose }) {
  const sheetRef = useRef(null);
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

  const meta = TYPE_CONFIG[row?.kind] ?? TYPE_CONFIG.expense;
  const Icon = meta.icon;
  // Title by item type (see TYPE_ITEM_TITLE) — same wording the details body's
  // "Type" row shows, so the header reads "Budget" / "Expenses" / "Abono" /
  // "Transfer" instead of the row's description. The one exception is a
  // received transfer: money came in, so it reads "Budget Received".
  const title =
    row?.kind === "transfer" && row?.direction === "received"
      ? "Budget Received"
      : (TYPE_ITEM_TITLE[row?.kind] ?? meta.label ?? "Transaction");

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="overview-sheet"
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
                  isFlagged(row)
                    ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : meta.iconWrapperClass,
                )}
              >
                <Icon size={20} />
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
                aria-label="Close transaction preview"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <OverviewDetailsBody row={row} meta={meta} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const COLUMN_WIDTHS = ["16%", "28%", "18%", "16%", "22%"];

export const TransactionsSection = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  // Mobile-only detail portal: the tapped card's row. Desktop has no dialog.
  const [sheetRow, setSheetRow] = useState(null);
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

  // The feed merges four sources, so never trust the incoming order: newest
  // record first — by when it was ADDED (`created_at`). An expense booked for
  // an older date still belongs on top when it was entered today.
  const sortedTransactions = useMemo(() => {
    const addedAt = (tx) => toDate(tx.created_at)?.getTime() ?? 0;
    return [...transactions].sort((a, b) => addedAt(b) - addedAt(a));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const { start, end } = dateRange ?? {};
    const inRange = (tx) => matchesDayRange(tx.date, start, end);
    if (!q) return sortedTransactions.filter(inRange);
    return sortedTransactions.filter((tx) => {
      if (!inRange(tx)) return false;
      const typeLabel = TYPE_CONFIG[tx.kind]?.label?.toLowerCase() || "";
      const desc = (tx.description || "").toLowerCase();
      const refLabel = (tx.reference_label || "").toLowerCase();
      const notes = (tx.notes || "").toLowerCase();
      const method = methodLabel(tx.method || "").toLowerCase();
      const status = (tx.status || "").toLowerCase();
      const direction = (tx.direction || "").toLowerCase();
      const counterparty = (tx.counterparty || "").toLowerCase();
      const amountStr = String(tx.amount || "");

      return (
        desc.includes(q) ||
        refLabel.includes(q) ||
        notes.includes(q) ||
        typeLabel.includes(q) ||
        method.includes(q) ||
        status.includes(q) ||
        direction.includes(q) ||
        counterparty.includes(q) ||
        amountStr.includes(q)
      );
    });
  }, [sortedTransactions, debouncedSearch, dateRange]);

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

  // "Showing X–Y of N" range for the pagination footer.
  const rangeStart =
    filteredTransactions.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    filteredTransactions.length,
  );
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
              <h3 className="font-display text-base font-semibold tracking-tight text-[var(--ink)]">
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
                    : "No budget issuances, expenses, abono or transfer records yet."
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
                  const transfer = isTransfer(tx);
                  const sent = isSentTransfer(tx);
                  const negative = isNegative(tx);
                  const amountColor = negative
                    ? "text-[var(--danger)]"
                    : tx.kind === "issued" || (!sent && transfer)
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--ink)]";
                  const flagged = isFlagged(tx);

                  return (
                    <tr
                      key={`${tx.kind}-${tx.id}`}
                      className={cn(
                        "relative transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]",
                        // Same status tones as the mobile cards: draft warns,
                        // cancelled reads danger. Flagged rows keep the normal
                        // tone — the "Flagged" badge below carries that state.
                        isDraftExpense(tx) &&
                          "bg-[var(--warning)]/[0.08] hover:bg-[var(--warning)]/[0.12]",
                        isCancelled(tx) &&
                          "bg-[var(--danger)]/[0.08] hover:bg-[var(--danger)]/[0.12]",
                      )}
                      title={
                        flagged
                          ? "Flagged — dated before the first budget issued to you"
                          : undefined
                      }
                    >
                      <td className="relative px-4 py-3 first:pl-5 align-middle">
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-transparent"
                        />
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
                        {flagged ? (
                          <span className="mt-1.5 inline-flex">
                            <Badge
                              tone="warning"
                              className="gap-1 px-1.5 py-0.5 text-[10px]"
                              title="Flagged — dated before the first budget issued to you"
                            >
                              <Flag
                                size={10}
                                aria-hidden
                                className="shrink-0"
                              />
                              Flagged
                            </Badge>
                          </span>
                        ) : transfer && tx.notes && transferCounterparty(tx) ? (
                          <p
                            className="mt-0.5 truncate text-[11px] leading-snug text-[var(--ink-muted)]"
                            title={transferCounterparty(tx)}
                          >
                            {transferCounterparty(tx)}
                          </p>
                        ) : tx.reference_label && tx.description ? (
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
                        {isDraftOrCancelled(tx) ? (
                          // Draft / cancelled expenses show their own status —
                          // the type badge's "Paid" would be wrong for them.
                          <ExpenseStatusBadge
                            status={tx.status}
                            className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
                          />
                        ) : isCancelledIssued(tx) ? (
                          // Cancelled issuance: danger identifier only — every
                          // tone on the row stays untouched.
                          <Badge
                            tone="danger"
                            className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
                          >
                            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                            <span className="truncate">Cancelled</span>
                          </Badge>
                        ) : transfer ? (
                          <Badge
                            tone={sent ? "neutral" : meta.badgeTone}
                            className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
                          >
                            <Icon
                              size={12}
                              strokeWidth={2.2}
                              className="shrink-0"
                            />
                            <span className="truncate">
                              {sent ? "Sent" : "Transfer"}
                            </span>
                          </Badge>
                        ) : (
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
                        )}
                      </td>
                      <td className="px-4 py-3 text-right last:pr-5 align-middle">
                        <span
                          className={cn(
                            "whitespace-nowrap font-display text-[15px] font-semibold tabular-nums",
                            amountColor,
                            (isCancelled(tx) || isCancelledIssued(tx)) &&
                              "line-through",
                          )}
                        >
                          {negative
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
          (() => {
            const dateGroups = groupTransactionsByDate(pageRows);
            return (
              <>
                {dateGroups.map(({ label, transactions }) => (
                  <div key={label} className="space-y-2.5">
                    <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      {label}
                    </h4>
                    {transactions.map((tx) => {
                      const meta = TYPE_CONFIG[tx.kind] ?? TYPE_CONFIG.expense;
                      const negative = isNegative(tx);
                      const sent = isSentTransfer(tx);
                      const amountColor = negative
                        ? "text-[var(--danger)]"
                        : tx.kind === "issued" || (!sent && isTransfer(tx))
                          ? "text-[var(--accent-strong)]"
                          : "text-[var(--warning)]";
                      const flagged = isFlagged(tx);

                      return (
                        <div
                          key={`${tx.kind}-${tx.id}`}
                          onClick={() => setSheetRow(tx)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            if (e.target.closest("button")) return;
                            e.preventDefault();
                            setSheetRow(tx);
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`View details for ${tx.description || meta.label}`}
                          className={cn(
                            "relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3.5 transition-shadow hover:shadow-card active:scale-[0.99]",
                            // Status tone drives the card: draft warns,
                            // cancelled reads danger. Flagged rows keep the
                            // normal tone — the "Flagged" pill badge below
                            // carries that state instead.
                            isDraftExpense(tx) &&
                              "border-[var(--warning)]/50 bg-[var(--warning)]/[0.08]",
                            isCancelled(tx) &&
                              "border-[var(--danger)]/40 bg-[var(--danger)]/[0.08]",
                          )}
                          title={
                            flagged
                              ? "Flagged — dated before the first budget issued to you"
                              : undefined
                          }
                        >
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-1 bg-transparent"
                          />
                          {/* Left: Icon & Details matching requested mobile structure */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold leading-none text-[var(--ink)]">
                                <span className="min-w-0 truncate capitalize">
                                  {tx.description || meta.label}
                                </span>
                                {isDraftOrCancelled(tx) && (
                                  <ExpenseStatusBadge
                                    status={tx.status}
                                    className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                                  />
                                )}
                                {flagged && (
                                  <Badge
                                    tone="warning"
                                    className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                                    title="Flagged — dated before the first budget issued to you"
                                  >
                                    <Flag
                                      size={10}
                                      aria-hidden
                                      className="shrink-0"
                                    />
                                    Flagged
                                  </Badge>
                                )}
                                {isCancelledIssued(tx) && (
                                  <Badge
                                    tone="danger"
                                    className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                                    title="Cancelled — this issuance no longer funds your balance"
                                  >
                                    Cancelled
                                  </Badge>
                                )}
                              </p>
                              {/* Meta row: type · short date · method badge */}
                              <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
                                <span className="shrink-0">
                                  {isTransfer(tx) &&
                                  tx?.direction === "received"
                                    ? "Received"
                                    : (TYPE_LABEL_SHORT[tx.kind] ?? meta.label)}
                                </span>
                                <span
                                  aria-hidden
                                  className="shrink-0 opacity-40"
                                >
                                  |
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {formatShortDate(tx.date)}
                                </span>
                                <span
                                  aria-hidden
                                  className="shrink-0 opacity-40"
                                >
                                  |
                                </span>
                                <span className="truncate text-[10px] type-eyebrow">
                                  {tx.method}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Right: Amount & Status */}
                          <div className="text-right shrink-0">
                            <p
                              className={cn(
                                "font-display text-sm font-semibold tabular-nums",
                                amountColor,
                                (isCancelled(tx) || isCancelledIssued(tx)) &&
                                  "line-through",
                              )}
                            >
                              {negative
                                ? `-${formatMoney(tx.amount)}`
                                : `+${formatMoney(tx.amount)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            );
          })()
        )}
      </div>

      {/* Pagination — footer strip under both the table and the mobile cards:
          count on the left, pager on the right (stacked and centred on
          mobile), matching the footer used by the other tables in the app. */}
      {!isLoading && filteredTransactions.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-[var(--ink-muted)]">
            Showing {rangeStart}–{rangeEnd} of {filteredTransactions.length}{" "}
            transactions
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <OverviewSheet row={sheetRow} onClose={() => setSheetRow(null)} />
    </Card>
  );
};

export default TransactionsSection;
