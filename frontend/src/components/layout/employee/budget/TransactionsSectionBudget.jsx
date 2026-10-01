import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  Search,
  Wallet,
  Wallet as MethodWalletIcon,
  X,
  XCircle,
  Inbox,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
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
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import { useBudgetTransferMutations } from "../../../../hooks/useBudgetTransfer";

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
      className={cn("shrink-0 px-2 py-1 text-[12px] truncate", className)}
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

// Budget transfers are identified by the ArrowLeftRight glyph everywhere in
// this ledger (card, table badge, sheet). Direction splits the reading:
// sent money leaves the pool (−, danger), received money widens it (+,
// accent) — the same sign convention the overview ledger uses.
const TRANSFER_META = {
  label: "Transfer",
  icon: ArrowLeftRight,
  iconWrapperClass: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
};

const isTransfer = (tx) => tx?.kind === "transfer";
const isSentTransfer = (tx) => isTransfer(tx) && tx?.direction === "sent";

// A cancelled issuance no longer funds the employee — mark it with a danger
// "Cancelled" badge and strike its amount, but leave every tone alone: row,
// badge family and amount color stay exactly as a live row renders.
const isCancelledIssued = (tx) =>
  tx?.kind === "issued" && tx?.status === "cancel";

const rowMeta = (tx) => (isTransfer(tx) ? TRANSFER_META : ISSUED_META);

const rowTitle = (tx) =>
  tx?.description ||
  (isTransfer(tx)
    ? isSentTransfer(tx)
      ? "Budget transfer sent"
      : "Budget transfer received"
    : "Issued budget");

// "To <name>" / "From <name>" second line for transfer rows.
const rowCounterparty = (tx) =>
  isTransfer(tx) && tx?.counterparty
    ? `${isSentTransfer(tx) ? "To" : "From"} ${tx.counterparty}`
    : "";

const rowSignedAmount = (tx) =>
  `${isSentTransfer(tx) ? "-" : "+"}${formatMoney(tx?.amount)}`;

const rowAmountClass = (tx) =>
  isTransfer(tx)
    ? isSentTransfer(tx)
      ? "text-[var(--danger)]"
      : "text-[var(--accent-strong)]"
    : "text-[var(--ink)]";

const SHEET_EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 50;
const COLUMN_WIDTHS = ["14%", "24%", "14%", "12%", "14%"];

const TransferDetailsBody = ({ row, pending, onCancel }) => {
  const sent = isSentTransfer(row);
  const counterparty = rowCounterparty(row);
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums",
              rowAmountClass(row),
            )}
          >
            {rowSignedAmount(row)}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
            {[counterparty || "Budget Transfer", methodLabel(row.method)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge tone={sent ? "neutral" : "success"}>
          <ArrowLeftRight size={12} aria-hidden className="shrink-0" />
          {sent ? "Sent" : "Received"}
        </Badge>
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="border-b border-[var(--border)] py-3 first:pt-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Description</p>
          <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)]">
            {row?.notes || row?.description || "—"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 py-1">
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
        </div>
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">
              {sent ? "Sent to" : "Received from"}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
              {row?.counterparty || "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Method</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
              {methodLabel(row?.method)}
            </p>
          </div>
        </div>
      </div>
      {/* Only the sender can take a transfer back — received rows offer no
          action. Cancelling asks for confirmation first, then deletes the
          `budget_transfer` record server-side. */}
      {sent && (
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full text-[var(--danger)]"
            disabled={pending}
            onClick={() => onCancel?.(row)}
          >
            <Trash2 size={15} aria-hidden />
            Cancel transfer
          </Button>
        </div>
      )}
    </div>
  );
};

const IssuedDetailsBody = ({ row }) => {
  const cancelled = isCancelledIssued(row);
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="flex items-center justify-between pt-3">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
            <p
              className={cn(
                "mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums",
                rowAmountClass(row),
                cancelled && "line-through",
              )}
            >
              {formatMoney(row?.amount)}
            </p>
            <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
              {["Employee Budget", methodLabel(row.method)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {cancelled ? (
            <Badge tone="danger" className="">
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              Cancelled
            </Badge>
          ) : (
            <Badge tone="success" className="">
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              Received
            </Badge>
          )}
        </div>
        <div className="  border-t border-[var(--border)] py-3">
          <div className="grid grid-cols-2 gap-3 py-1">
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
          </div>
        </div>
      </div>
    </div>
  );
};

function TransactionCard({ tx, onOpen }) {
  const meta = rowMeta(tx);
  const Icon = meta.icon;
  const counterparty = rowCounterparty(tx);
  // Card title is the record kind — admin issuances read "Budget Issued",
  // sent transfers read "Budget Transfer", received transfers read
  // "Budget Received". The row's own description stays in the details sheet
  // and the desktop table.
  const title = isTransfer(tx)
    ? isSentTransfer(tx)
      ? "Budget Transfer"
      : "Budget Received"
    : "Budget Issued";

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
      aria-label={`View details for ${title}`}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 py-3 transition-shadow hover:shadow-card active:scale-[0.99]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            meta.iconWrapperClass,
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold leading-none text-[var(--ink)]">
            <span className="min-w-0 truncate">{title}</span>
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
          <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
            <span className="shrink-0 tabular-nums">
              {formatShortDate(tx.date)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="truncate text-[10px] type-eyebrow">
              {counterparty || methodLabel(tx.method)}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p
          className={cn(
            "text-right font-display text-sm font-semibold tabular-nums",
            rowAmountClass(tx),
            isCancelledIssued(tx) && "line-through",
          )}
        >
          {isTransfer(tx) ? rowSignedAmount(tx) : formatMoney(tx.amount)}
        </p>
      </div>
    </div>
  );
}

/* ── Mobile bottom sheet — same slide-up animation as the expenses sheet ── */
function TransactionSheet({ row, pending, onClose, onCancel }) {
  const sheetRef = useRef(null);
  const close = useCallback(() => {
    if (pending) return;
    onClose?.();
  }, [onClose, pending]);

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

  const meta = rowMeta(row);
  // Sheet headline follows the card: budget issuances read "Budget Issued",
  // sent transfers read "Budget Transfer", received transfers read
  // "Budget Received". The row's own description stays in the details body
  // below.
  const title = isTransfer(row)
    ? isSentTransfer(row)
      ? "Budget Transfer"
      : "Budget Received"
    : "Budget Issued";

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
                  meta.iconWrapperClass,
                )}
              >
                <meta.icon size={20} />
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
            {isTransfer(row) ? (
              <TransferDetailsBody
                row={row}
                pending={pending}
                onCancel={onCancel}
              />
            ) : (
              <IssuedDetailsBody row={row} />
            )}
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
  const [cancelRow, setCancelRow] = useState(null);
  const { cancelTransfer } = useBudgetTransferMutations();
  const cancelPending = cancelTransfer.isPending;

  const closeCancelConfirm = () => {
    if (!cancelPending) setCancelRow(null);
  };

  // Central gate for the sheet's cancel button. Only sent transfers offer
  // the action; the server re-checks ownership and the recipient's balance.
  const requestCancel = (row) => {
    if (!row || !isSentTransfer(row)) return;
    setCancelRow(row);
  };

  const runCancel = async () => {
    if (!cancelRow) return;
    try {
      await cancelTransfer.mutateAsync(cancelRow.id);
      toast.success("Budget transfer cancelled");
      setCancelRow(null);
      setSheetRow(null);
    } catch (err) {
      toast.error(err?.message || "Couldn't cancel budget transfer");
    }
  };

  const cancelSummary = cancelRow ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[var(--ink)]">
          {rowCounterparty(cancelRow) || "Budget transfer"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {formatDate(cancelRow.date)}
          {cancelRow.date ? ` · ${formatTime(cancelRow.date)}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--danger)]">
        -{formatMoney(cancelRow.amount)}
      </span>
    </div>
  ) : null;

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
      const kind = (tx.kind || "").toLowerCase();
      const direction = (tx.direction || "").toLowerCase();
      const counterparty = (tx.counterparty || "").toLowerCase();
      const amountStr = String(tx.amount || "");

      return (
        desc.includes(q) ||
        source.includes(q) ||
        notes.includes(q) ||
        method.includes(q) ||
        status.includes(q) ||
        kind.includes(q) ||
        direction.includes(q) ||
        counterparty.includes(q) ||
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
    <Card className="overflow-hidden px-2.5">
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
              Issued budgets and budget transfers.
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
                    : "Budgets your admin issues and transfers will appear here."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Employee issued budget list</caption>
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
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageRows.map((tx) => {
                  const transfer = isTransfer(tx);
                  const sent = isSentTransfer(tx);
                  const counterparty = rowCounterparty(tx);
                  const subline = transfer
                    ? [counterparty, tx.notes].filter(Boolean).join(" · ")
                    : tx.notes;
                  return (
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
                          title={rowTitle(tx)}
                        >
                          {rowTitle(tx)}
                        </p>
                        {subline && (
                          <p
                            className="mt-0.5 truncate text-[11px] leading-snug text-[var(--ink-muted)]"
                            title={subline}
                          >
                            {subline}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <MethodBadge method={tx.method} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {transfer ? (
                          <Badge tone={sent ? "neutral" : "success"}>
                            <ArrowLeftRight
                              size={12}
                              aria-hidden
                              className="shrink-0"
                            />
                            {sent ? "Sent" : "Received"}
                          </Badge>
                        ) : isCancelledIssued(tx) ? (
                          <Badge tone="danger">
                            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                            Cancelled
                          </Badge>
                        ) : (
                          <Badge tone="success">
                            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                            Received
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span
                          className={cn(
                            "text-[13px] font-semibold tabular-nums",
                            rowAmountClass(tx),
                            isCancelledIssued(tx) && "line-through",
                          )}
                        >
                          {transfer
                            ? rowSignedAmount(tx)
                            : formatMoney(tx.amount)}
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
                    : "Budgets your admin issues and transfers will appear here."
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
            records
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <TransactionSheet
        row={sheetRow}
        pending={cancelPending}
        onClose={() => setSheetRow(null)}
        onCancel={requestCancel}
      />

      <ConfirmActionDialog
        open={Boolean(cancelRow)}
        icon={<XCircle size={20} aria-hidden />}
        title="Cancel this budget transfer?"
        description="This permanently deletes the transfer record and returns the amount to your remaining balance. This can't be undone."
        summary={cancelSummary}
        cancelLabel="Keep transfer"
        confirmLabel="Yes, cancel it"
        pendingLabel="Cancelling…"
        pending={cancelPending}
        onCancel={closeCancelConfirm}
        onConfirm={runCancel}
      />
    </Card>
  );
};

export default TransactionsSectionBudget;
