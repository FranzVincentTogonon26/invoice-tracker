import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Banknote,
  Calendar,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Eye,
  FileText,
  Image as ImageIcon,
  Landmark,
  Loader2,
  Maximize2,
  ReceiptText,
  RotateCcw,
  Store,
  Tag,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { useExpenseDetail } from "../../../../hooks/useExpenses";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";
import { ExpenseStatusBadge } from "./ExpensesTable";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatQty = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const getMethodIcon = (method) => {
  switch (method) {
    case "cash":
      return <Banknote size={14} aria-hidden />;
    case "bank_transfer":
      return <Landmark size={14} aria-hidden />;
    case "e_wallet":
      return <Wallet size={14} aria-hidden />;
    case "cheque":
      return <FileText size={14} aria-hidden />;
    default:
      return <CreditCard size={14} aria-hidden />;
  }
};

const FieldLabel = ({ children }) => (
  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
    {/* {icon} */}
    <span>{children}</span>
  </p>
);

const CreatorRow = ({ row }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs">
    {row?.employeeAvatar ? (
      <img
        src={row.employeeAvatar}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--border)]"
      />
    ) : (
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-strong)]"
      >
        {initialsOf(row?.employee)}
      </span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold leading-tight text-[var(--ink)]">
        {row?.employee || "Unknown"}
      </p>
      {row?.employeeRole ? (
        <p className="mt-0.5 truncate text-xs capitalize text-[var(--ink-muted)]">
          {row.employeeRole}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Submitted by</p>
      )}
    </div>
  </div>
);

const LineCells = ({ item, index }) => (
  <>
    <td className="px-4 py-3 align-top">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[10px] font-bold tabular-nums text-[var(--ink-muted)]"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium leading-snug text-[var(--ink)]">
            {item.description || "Unnamed item"}
          </p>
          {(item.quantity > 0 || item.rate > 0) && (
            <p className="mt-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
              {item.quantity ? `Qty: ${formatQty(item.quantity)}` : null}
              {item.quantity && item.rate ? " · " : null}
              {item.rate ? `@ ${formatMoney(item.rate)} each` : null}
            </p>
          )}
        </div>
      </div>
    </td>
    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-semibold tabular-nums text-[var(--ink)]">
      {formatMoney(item.amount)}
    </td>
  </>
);

const LineItemsSection = ({
  lines,
  open,
  onToggle,
  loading,
  error,
  onRetry,
  refetching,
  regionId,
}) => {
  if (loading) {
    return (
      <section
        aria-label="Receipt items"
        aria-busy="true"
        role="status"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Receipt items
          </p>
          <span className="h-5 w-14 animate-pulse rounded-full bg-[var(--surface-2)]" />
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 animate-pulse rounded-full bg-[var(--surface-2)]" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Receipt items"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Receipt items
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-[var(--danger)]/10 px-4 py-4">
          <AlertCircle
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--danger)]"
          />
          <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-[var(--danger)]">
            Couldn&apos;t load receipt items
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={refetching}
          >
            {refetching && (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            )}
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section
        aria-label="Receipt items"
        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center"
      >
        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
          <FileText size={16} aria-hidden />
        </span>
        <p className="mt-2 text-xs font-semibold text-[var(--ink)]">
          No itemized lines found
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
          This receipt didn&apos;t include itemized details.
        </p>
      </section>
    );
  }

  const itemsTotal = lines.reduce((sum, it) => sum + (it.amount || 0), 0);

  return (
    <section
      aria-label="Receipt items"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide uppercase text-[var(--ink)]">
              Receipt Items
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-muted)]">
              {lines.length} {lines.length === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Total itemized:{" "}
            <span className="font-semibold text-[var(--ink)]">
              {formatMoney(itemsTotal)}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] shadow-2xs">
          <span>{open ? "Hide items" : "Show items"}</span>
          <ChevronDown
            size={14}
            aria-hidden
            className={cn(
              "transition-transform duration-200 text-[var(--ink-muted)]",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="items-table-content"
            id={regionId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <div className="scrollbar-slim max-h-[280px] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                      Item description
                    </th>
                    <th className="w-[120px] px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60 bg-[var(--surface)]">
                  {lines.map((item, index) => (
                    <tr
                      key={item.key}
                      className="transition-colors hover:bg-[var(--surface-2)]/40"
                    >
                      <LineCells item={item} index={index} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-2.5 text-xs">
              <span className="text-[var(--ink-muted)]">
                Scanned line items total
              </span>
              <span className="font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(itemsTotal)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const ExpenseDetailsModal = ({
  open,
  expense,
  referenceLabel = "",
  onClose,
}) => {
  const titleId = useId();
  const itemsRegionId = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const row = expense;

  // Reset the view (zoom level + items panel) on every open. Adjusting state
  // during render is the documented alternative to a setState-in-effect — the
  // same pattern BudgetModal / ReferencesModal use.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setZoomLevel(1);
    setItemsOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setFailedUrl(null);
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const receiptUrl = row?.imageUrl || "";
  const receiptIsPdf = isReceiptPdf(receiptUrl);
  const hasReceipt = Boolean(row?.receiptId || receiptUrl);
  const canPreviewImage =
    Boolean(receiptUrl) && !receiptIsPdf && failedUrl !== receiptUrl;

  const detailExpenseId = open && hasReceipt && row?.id ? row.id : null;
  const {
    receiptItems,
    vendor: detailVendor,
    isLoading: linesLoading,
    isFetching: linesFetching,
    isError: linesError,
    refetch: refetchLines,
  } = useExpenseDetail(detailExpenseId);
  const linesRefetching = linesFetching && !linesLoading;

  const receiptLines = useMemo(
    () =>
      (receiptItems ?? []).map((item, index) => ({
        key: `${item?.id ?? "line"}-${index}`,
        description: String(item?.description ?? "").trim(),
        quantity: toNumber(item?.qty),
        rate: toNumber(item?.rate),
        amount: toNumber(item?.amount),
      })),
    [receiptItems],
  );

  const recordedTotal = toNumber(row?.amount);
  const vendorName = String(detailVendor ?? "").trim();

  const handleClose = () => {
    setFailedUrl(null);
    setZoomLevel(1);
    onClose?.();
  };

  const zoomIn = () =>
    setZoomLevel((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))));
  const zoomOut = () =>
    setZoomLevel((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))));
  const zoomReset = () => setZoomLevel(1);

  const flaggedNotice = row?.flagged ? (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3.5"
    >
      <TriangleAlert
        size={16}
        aria-hidden
        className="mt-0.5 shrink-0 text-[var(--danger)]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[var(--danger)]">
          Receipt date predates the budget issuance date
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--danger)]/90">
          This receipt is dated before the budget was issued to the employee.
          Please verify the receipt details and legitimacy before approving.
        </p>
      </div>
    </div>
  ) : null;

  const detailRows = (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <FieldLabel
          icon={
            <Calendar
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
        >
          Receipt date Expense
        </FieldLabel>
        <p className="text-sm font-semibold text-[var(--ink)]">
          {formatDate(row?.date)}
          {row?.timeDate ? (
            <span className="font-normal text-[var(--ink-muted)]">
              {" "}
              · {formatTime(row?.timeDate)}
            </span>
          ) : null}
        </p>
      </div>

      {row?.receiptDate ? (
        <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <FieldLabel
            icon={
              <CalendarClock
                size={13}
                aria-hidden
                className="shrink-0 text-[var(--accent-strong)]"
              />
            }
          >
            Receipt date entry
          </FieldLabel>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {formatDate(row.timeDate)}
          </p>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <FieldLabel
          icon={
            <Wallet
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
        >
          Payment method
        </FieldLabel>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
          <span className="text-[var(--ink-muted)]">
            {getMethodIcon(row?.method)}
          </span>
          {methodLabel(row?.method)}
        </p>
      </div>

      {row?.category ? (
        <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <FieldLabel
            icon={
              <Tag
                size={13}
                aria-hidden
                className="shrink-0 text-[var(--accent-strong)]"
              />
            }
          >
            Category
          </FieldLabel>
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {row.category}
          </p>
        </div>
      ) : null}

      {referenceLabel ? (
        <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-2">
          <FieldLabel
            icon={
              <Tag
                size={13}
                aria-hidden
                className="shrink-0 text-[var(--accent-strong)]"
              />
            }
          >
            Source of funds
          </FieldLabel>
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {referenceLabel}
          </p>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <FieldLabel
          icon={
            <UserRound
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
        >
          Submitted by
        </FieldLabel>
        <CreatorRow row={row} />
      </div>

      {row?.notes ? (
        <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-2">
          <FieldLabel
            icon={
              <FileText
                size={13}
                aria-hidden
                className="shrink-0 text-[var(--ink-muted)]"
              />
            }
          >
            Notes / remarks
          </FieldLabel>
          <p className="break-words text-xs italic leading-relaxed text-[var(--ink)]">
            {row.notes}
          </p>
        </div>
      ) : null}
    </dl>
  );

  const titleBlock = (
    <div className="min-w-0 space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <FieldLabel
        icon={
          <Store
            size={13}
            aria-hidden
            className="shrink-0 text-[var(--accent-strong)]"
          />
        }
      >
        Vendor / description
      </FieldLabel>
      <p className="break-words font-display text-base font-semibold leading-snug text-[var(--ink)]">
        {vendorName || row?.description || "Untitled expense"}
      </p>
      {vendorName && row?.description && vendorName !== row.description ? (
        <p className="break-words text-xs leading-relaxed text-[var(--ink-muted)]">
          {row.description}
        </p>
      ) : null}
    </div>
  );

  const amountBlock = (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <FieldLabel
        icon={
          <ReceiptText
            size={13}
            aria-hidden
            className="shrink-0 text-[var(--accent-strong)]"
          />
        }
      >
        Total amount
      </FieldLabel>
      <div className="flex flex-row items-center gap-3">
        <p className="mt-1.5 font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-[var(--ink)]">
          {formatMoney(recordedTotal)}
        </p>
        <ExpenseStatusBadge status={row?.status} />
      </div>
    </div>
  );

  const receiptPreview = canPreviewImage ? (
    <div className="flex flex-col bg-[#0b100f]">
      {/* ── Viewer toolbar: zoom controls + open full size ── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-white/70">
          <ImageIcon size={13} aria-hidden className="shrink-0" />
          <span className="truncate">Receipt image</span>
          {zoomLevel !== 1 ? (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
              {Math.round(zoomLevel * 100)}%
            </span>
          ) : null}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomLevel <= 0.75}
            title="Zoom out"
            aria-label="Zoom out receipt image"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <ZoomOut size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={zoomReset}
            disabled={zoomLevel === 1}
            title="Reset zoom"
            aria-label="Reset receipt zoom"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <RotateCcw size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomLevel >= 2.2}
            title="Zoom in"
            aria-label="Zoom in receipt image"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <ZoomIn size={13} aria-hidden />
          </button>
          <span aria-hidden className="mx-1 h-3 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => openReceiptFile(receiptUrl)}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-strong)] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Maximize2 size={12} aria-hidden />
            Full size
          </button>
        </div>
      </div>

      {/* ── Large, legible receipt viewport ── */}
      <div className="scrollbar-slim relative max-h-[560px] min-h-[380px] overflow-auto p-4 lg:max-h-[640px]">
        <img
          src={receiptUrl}
          alt="Scanned receipt"
          onError={() => setFailedUrl(receiptUrl)}
          style={{ transform: `scale(${zoomLevel})` }}
          className="mx-auto block w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl transition-transform duration-150"
        />
      </div>
    </div>
  ) : receiptUrl ? (
    <div className="flex min-h-[340px] w-full flex-col items-center justify-center gap-4 bg-[var(--surface-2)]/50 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        {receiptIsPdf ? (
          <FileText size={28} aria-hidden />
        ) : (
          <ImageIcon size={28} aria-hidden />
        )}
      </span>
      <div className="max-w-[320px] space-y-1">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {receiptIsPdf ? "PDF document receipt" : "Receipt attachment"}
        </p>
        <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
          {receiptIsPdf
            ? "This expense is linked to a PDF document. Open it to inspect the full receipt."
            : "A preview can't be shown here. Open the original file to view it."}
        </p>
      </div>
      <Button
        type="button"
        variant="accent"
        size="sm"
        onClick={() => openReceiptFile(receiptUrl)}
        className="gap-1.5"
      >
        <Eye size={14} aria-hidden />
        {receiptIsPdf ? "Open PDF document" : "Open file"}
      </Button>
    </div>
  ) : (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 bg-[var(--surface-2)]/40 px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
        <ReceiptText size={24} aria-hidden />
      </span>
      <span className="max-w-[240px] text-[13px] font-medium leading-snug text-[var(--ink-muted)]">
        No receipt image attached to this expense
      </span>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/45 p-3 backdrop-blur-md sm:p-5"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.28, ease: DIALOG_EASE }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "p-3 relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/15",
              hasReceipt ? "max-w-[1120px]" : "max-w-[520px]",
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-3  px-5 pt-4 ">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="font-display truncate text-lg font-semibold tracking-tight text-[var(--ink)]"
                  >
                    Expense details
                  </h3>
                  <p className="mt-0.5 truncate lg:text-sm text-xs text-[var(--ink-muted)]">
                    {hasReceipt
                      ? "Receipt & items on the left · expense details on the right"
                      : "Recorded expense without a receipt scan"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close expense details"
                  autoFocus
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>

            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {hasReceipt ? (
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  {/* ── Left: receipt document + toggleable items ── */}
                  <div className="min-w-0 space-y-4">
                    <section
                      aria-label="Receipt document"
                      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                            Receipt document
                          </p>
                          {receiptIsPdf ? (
                            <Badge
                              tone="accent"
                              className="px-1.5 py-0.5 text-[10px]"
                            >
                              PDF
                            </Badge>
                          ) : null}
                        </div>
                        {!receiptIsPdf && receiptUrl ? (
                          <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                            Zoom to read details
                          </span>
                        ) : null}
                      </div>
                      {receiptPreview}
                    </section>

                    <LineItemsSection
                      lines={receiptLines}
                      open={itemsOpen}
                      onToggle={() => setItemsOpen((prev) => !prev)}
                      loading={linesLoading}
                      error={linesError}
                      onRetry={() => refetchLines()}
                      refetching={linesRefetching}
                      regionId={itemsRegionId}
                    />
                  </div>

                  {/* ── Right: recorded expense details ── */}
                  <section
                    aria-label="Expense details"
                    className="min-w-0 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/35 p-5 shadow-xs"
                  >
                    {flaggedNotice}
                    {amountBlock}
                    {titleBlock}
                    <div className="border-t border-[var(--border)] pt-4">
                      {detailRows}
                    </div>
                  </section>
                </div>
              ) : (
                <section
                  aria-label="Expense details"
                  className="mx-auto max-w-[460px] space-y-4"
                >
                  {flaggedNotice}
                  {amountBlock}
                  {titleBlock}
                  <div className="border-t border-[var(--border)] pt-4">
                    {detailRows}
                  </div>
                </section>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3  px-5 py-3.5 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-full px-5 text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpenseDetailsModal;
