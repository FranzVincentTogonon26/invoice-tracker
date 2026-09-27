import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Banknote,
  CreditCard,
  Eye,
  Landmark,
  Layers,
  Search,
  Trash2,
  X,
  Inbox,
  Wallet,
  ReceiptText,
  HandCoins,
  Wallet as MethodWalletIcon,
  EllipsisVertical,
} from "lucide-react";
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
  isSameDay,
  matchesDayRange,
  methodLabel,
  startOfDay,
  toDate,
  addDays,
} from "../../../../lib/utils";
import DateRangePicker from "../../../ui/DateRangePicker";
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import EmployeeExpenseDetailsModal from "./EmployeeExpenseDetailsModal";
import { useExpensesMutations } from "../../../../hooks/useExpenses";

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

const SHEET_EASE = [0.16, 1, 0.3, 1];
const isSheetActionable = (row) => row?.kind === "expense";
// Mirrors EmployeeExpenseDetailsModal: a receipt exists when the row links a
// receipt record or carries a stored receipt file URL (image or PDF).
const hasSheetReceipt = (row) => Boolean(row?.receiptId || row?.imageUrl);
const PAGE_SIZE = 50;

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

const COLUMN_WIDTHS = ["16%", "28%", "18%", "16%", "22%", "5%"];

function TransactionCard({ tx, meta, disabled, onOpen }) {
  const actionable = isSheetActionable(tx);
  const Icon = meta.icon;

  return (
    <div
      onClick={() => {
        if (!actionable || disabled) return;
        onOpen?.();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (!actionable || disabled || e.target.closest("button")) return;
        e.preventDefault();
        onOpen?.();
      }}
      role="button"
      tabIndex={actionable && !disabled ? 0 : undefined}
      aria-label={`Open details for ${tx.description || meta.label}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 py-3 transition-shadow hover:shadow-card",
        actionable && !disabled && "cursor-pointer active:scale-[0.99]",
      )}
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
          <p className="truncate text-xs font-semibold leading-none text-[var(--ink)]">
            {tx.description || meta.label}
          </p>
          <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
            <span className="shrink-0 tabular-nums">
              {formatShortDate(tx.date)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="truncate text-[10px] type-eyebrow">
              {methodLabel(tx.method)}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <p className="text-right font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(tx.amount)}
        </p>
      </div>
    </div>
  );
}

function TransactionSheet({ row, pending, onClose, onView, onDelete }) {
  const sheetRef = useRef(null);
  const actionable = isSheetActionable(row);
  const meta = TYPE_CONFIG[row?.kind] ?? TYPE_CONFIG.expense;
  const Icon = meta.icon;
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

  const title = row?.description || meta.label || "Transaction";

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="expense-sheet"
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
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: SHEET_EASE }}
            className={cn(
              "relative max-h-[88dvh] w-full overflow-y-auto scrollbar-slim outline-none overscroll-contain",
              "rounded-t-[15px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover will-change-transform",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <TransactionSheetBody
              row={row}
              meta={meta}
              Icon={Icon}
              title={title}
              actionable={actionable}
              hasReceipt={hasSheetReceipt(row)}
              pending={pending}
              close={close}
              onView={onView}
              onDelete={onDelete}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function TransactionSheetBody({
  row,
  meta,
  Icon,
  title,
  actionable,
  hasReceipt,
  pending,
  close,
  onView,
  onDelete,
}) {
  return (
    <>
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
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight text-[var(--ink)]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
            {formatDate(row.date)}
            {row.timeDate ? ` · ${formatTime(row.timeDate)}` : ""}
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
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
            <p className="mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
              {formatMoney(row.amount)}
            </p>
            <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
              {[row.category, methodLabel(row.method)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {row.status && row.status !== "paid" && (
            <ExpenseStatusBadge status={row.status} className="shrink-0" />
          )}
        </div>
        {row.notes && (
          <p className="rounded-2xl border-l-2 border-[var(--accent)]/40 bg-[var(--surface-2)]/50 px-4 py-3 text-sm italic leading-relaxed text-[var(--ink-muted)]">
            {row.notes}
          </p>
        )}
      </div>
      {actionable && (
        <div className="mt-4 space-y-2">
          {hasReceipt ? (
            <Button
              type="button"
              variant="accent"
              className="w-full"
              onClick={() => {
                close();
                onView?.(row);
              }}
            >
              <Eye size={15} aria-hidden />
              View details & receipt
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full text-[var(--danger)]"
            disabled={pending}
            onClick={() => onDelete?.(row)}
          >
            <Trash2 size={15} aria-hidden />
            Delete expense
          </Button>
        </div>
      )}
    </>
  );
}

function RowActions({ row, pending, onView, onDelete }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const close = () => {
      setOpen(false);
      btnRef.current?.focus();
    };

    const handlePointerDown = (e) => {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      )
        close();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const items = [
    {
      key: "view",
      label: "View expense",
      Icon: Eye,
      danger: false,
      onSelect: () => onView?.(row),
    },
    {
      key: "delete",
      label: "Delete expense",
      Icon: Trash2,
      danger: true,
      onSelect: () => onDelete?.(row),
    },
  ];

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_H = 80;
      const roomBelow = window.innerHeight - rect.bottom;
      const flipUp = roomBelow < MENU_H + 8 && rect.top > MENU_H + 8;

      setPosition({
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${row?.description || "expense"}`}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
      >
        <EllipsisVertical size={16} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Row actions"
            style={{ ...position }}
            className="fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {items.map(({ key, label, Icon, danger, onSelect }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40",
                  danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
                )}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export const TransactionsSectionExpenses = ({
  transactions = [],
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [sheetRow, setSheetRow] = useState(null);
  const { setStatus } = useExpensesMutations();
  const confirmPending = setStatus.isPending;

  const closeConfirm = () => {
    if (!confirmPending) setDeleteRow(null);
  };

  const runMarkDraft = async () => {
    if (!deleteRow) return;

    try {
      await setStatus.mutateAsync({ id: deleteRow.id, status: "draft" });
      toast.success("Expense moved to draft");
      setDeleteRow(null);
      setSheetRow(null);
    } catch (err) {
      toast.error(err?.message || "Couldn’t move expense to draft");
    }
  };

  const confirmSummary = deleteRow ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[var(--ink)]">
          {deleteRow.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${deleteRow.category || "Uncategorized"} · ${formatDate(deleteRow.date)}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
        {formatMoney(deleteRow.amount)}
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
                All Expenses
              </h3>
            </div>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Monitor spending and expenses.
            </p>
          </div>
        </div>
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
                    Payment Method
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
                    Amount
                  </th>
                  <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageRows.map((tx) => {
                  const meta = TYPE_CONFIG[tx.kind] ?? TYPE_CONFIG.expense;
                  const Icon = meta.icon;

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
                          {tx.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <MethodBadge
                          method={tx.method}
                          className="max-w-full"
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {tx.status ? (
                          <ExpenseStatusBadge
                            status={tx.status}
                            className="max-w-full px-2 py-1 text-[11px]"
                          />
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
                          )}
                        >
                          {formatMoney(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-4 pr-5 text-right align-middle">
                        <div className="flex justify-end">
                          <RowActions
                            row={tx}
                            pending={confirmPending}
                            onView={setViewRow}
                            onDelete={setDeleteRow}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
        ) : (() => {
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

                    return (
                      <TransactionCard
                        key={`${tx.kind}-${tx.id}`}
                        tx={tx}
                        meta={meta}
                        disabled={confirmPending}
                        onOpen={() => setSheetRow(tx)}
                        onDelete={() => setDeleteRow(tx)}
                      />
                    );
                  })}
                </div>
              ))}
            </>
          );
        })()}
      </div>

      {!isLoading && filteredTransactions.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-[var(--ink-muted)]">
            Showing {rangeStart}–{rangeEnd} of {filteredTransactions.length}{" "}
            transactions
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <EmployeeExpenseDetailsModal
        open={Boolean(viewRow)}
        expense={viewRow}
        onClose={() => setViewRow(null)}
      />

      <TransactionSheet
        row={sheetRow}
        pending={confirmPending}
        onClose={() => setSheetRow(null)}
        onView={setViewRow}
        onDelete={setDeleteRow}
      />

      <ConfirmActionDialog
        open={Boolean(deleteRow)}
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this expense?"
        description="Nothing is permanently removed — the expense is kept as a Draft, but it will no longer show in your expense list."
        summary={confirmSummary}
        cancelLabel="Keep expense"
        confirmLabel="Yes, delete it"
        pendingLabel="Deleting…"
        pending={confirmPending}
        onCancel={closeConfirm}
        onConfirm={runMarkDraft}
      />
    </Card>
  );
};

export default TransactionsSectionExpenses;
