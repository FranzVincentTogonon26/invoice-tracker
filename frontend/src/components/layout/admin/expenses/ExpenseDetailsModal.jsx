import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Banknote,
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
  ShieldCheck,
  TriangleAlert,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { TextArea } from "../../../ui/Input";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import {
  useExpenseDetail,
  useExpensesMutations,
} from "../../../../hooks/useExpenses";
import { expensesApi } from "../../../../api/expenses";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";
import { ExpenseStatusBadge } from "./ExpensesTable";
import ConfirmActionDialog from "./ConfirmActionDialog";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
const REVIEW_NOTES_MAX = 1000;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatQty = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

const getMethodIcon = (method) => {
  switch (method) {
    case "cash":
      return <Banknote size={13} aria-hidden />;
    case "bank_transfer":
      return <Landmark size={13} aria-hidden />;
    case "e_wallet":
      return <Wallet size={13} aria-hidden />;
    case "cheque":
      return <FileText size={13} aria-hidden />;
    default:
      return <CreditCard size={13} aria-hidden />;
  }
};

const CreatorRow = ({ row }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
    <EmployeeAvatar
      name={row?.employee}
      avatarUrl={row?.employeeAvatar}
      className="h-8 w-8 shrink-0 text-xs"
    />
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold leading-tight text-[var(--ink)]">
        {row?.employee || "Unknown"}
      </p>
      <p className="mt-0.5 truncate text-[11px] capitalize text-[var(--ink-muted)]">
        {row?.employeeRole || "Submitted by"}
      </p>
    </div>
  </div>
);

const ReviewNotesCard = ({ row }) => {
  const { updateNotes } = useExpensesMutations();
  const saving = updateNotes.isPending;
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [committed, setCommitted] = useState(null);
  const [error, setError] = useState(null);

  const [notesFor, setNotesFor] = useState(row?.id);
  if (notesFor !== row?.id) {
    setNotesFor(row?.id);
    setNotes(row?.notes ?? "");
    setCommitted(null);
    setError(null);
  }

  const stored = committed ?? row?.notes ?? "";
  const dirty = notes.trim() !== stored.trim();

  const handleSave = async () => {
    if (!row?.id || saving || !dirty) return;
    const trimmed = notes.trim();
    if (trimmed.length > REVIEW_NOTES_MAX) {
      setError(
        `Notes are too long (max ${REVIEW_NOTES_MAX} characters). Shorten them to save.`,
      );
      return;
    }
    setError(null);
    try {
      await updateNotes.mutateAsync({ id: row.id, notes: trimmed });
      setCommitted(trimmed);
      toast.success("Review notes saved");
    } catch (err) {
      setError(err?.message || "Couldn't save review notes. Try again.");
    }
  };

  return (
    <div className="min-w-0 space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <p className="type-eyebrow text-[var(--ink-muted)]">Review Notes</p>
        <span className="text-[10px] text-[var(--ink-muted)]">
          Draft review comments
        </span>
      </div>
      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={REVIEW_NOTES_MAX}
        disabled={saving}
        placeholder="e.g. Receipt total doesn't match the scanned items — verify with the employee."
        aria-label="Admin review notes"
        className="w-full text-xs"
      />
      {error ? (
        <p
          role="alert"
          className="text-[11px] font-medium text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] tabular-nums text-[var(--ink-muted)]">
          {notes.length}/{REVIEW_NOTES_MAX}
        </span>
        <Button
          type="button"
          variant="soft"
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-7 text-xs"
        >
          {saving && <Loader2 size={12} className="animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
};

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
        <div className="space-y-3 px-4 py-3">
          <div className="items-center gap-3 space-y-3">
            <span className="flex h-5 w-20 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <div className="flex h-3 flex-1 animate-pulse rounded-full bg-[var(--surface-2)]" />
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
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
              Scanned line items
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-normal text-[var(--ink-muted)]">
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
              "text-[var(--ink-muted)] transition-transform duration-200",
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
            <div className="scrollbar-slim max-h-[260px] overflow-y-auto">
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
  onFlagCleared,
}) => {
  const dialogRef = useRef(null);
  const itemsRegionId = useId();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("details");
  const [failedUrl, setFailedUrl] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [clearedFlagId, setClearedFlagId] = useState(null);
  const [flagConfirmOpen, setFlagConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const row = expense;

  // Reset state on open or row change
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setActiveTab("details");
    setZoomLevel(1);
    setItemsOpen(false);
    if (!open) {
      setClearedFlagId(null);
      setFlagConfirmOpen(false);
    }
  }

  const [prevRowId, setPrevRowId] = useState(row?.id);
  if (prevRowId !== row?.id) {
    setPrevRowId(row?.id);
    setActiveTab("details");
    setClearedFlagId(null);
    setFlagConfirmOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (flagConfirmOpen) return;
      e.stopPropagation();
      setFailedUrl(null);
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, flagConfirmOpen]);

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

  const vendorName = String(detailVendor ?? "").trim();
  const title = vendorName || row?.description || "Expense details";

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

  const handleApproveFlag = async () => {
    if (!row?.id || approving) return;
    setApproving(true);
    setApproveError(null);
    try {
      await expensesApi.clearFlag(row.id);
      setClearedFlagId(row.id);
      setFlagConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
      onFlagCleared?.(row.id);
      toast.success("Flag approved");
    } catch (err) {
      setApproveError(err?.message || "Couldn’t approve flag. Try again.");
      setFlagConfirmOpen(false);
    } finally {
      setApproving(false);
    }
  };

  const confirmSummary = row ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[var(--ink)]">
          {row.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${row.category || "Uncategorized"} · ${formatDate(row.date)}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
        {formatMoney(row.amount)}
      </span>
    </div>
  ) : null;

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <motion.div
          key="overview-dialog"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className={cn(
              "relative max-h-[85dvh] w-full overflow-y-auto scrollbar-slim rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover outline-none sm:p-6 transition-all duration-200",
              hasReceipt && activeTab === "receipt" ? "max-w-2xl" : "max-w-lg",
            )}
          >
            {/* ── Dialog Header matching Overview design ── */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  row?.flagged && clearedFlagId !== row?.id
                    ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                )}
              >
                <ReceiptText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold tracking-tight text-[var(--ink)]">
                  Expense details
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatDate(row?.date)}
                  {row?.date ? ` · ${formatTime(row.date)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close transaction details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Optional tabs if receipt exists ── */}
            {hasReceipt && (
              <div className="mt-4 flex rounded-xl bg-[var(--surface-2)] p-1">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
                    activeTab === "details"
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                    activeTab === "receipt"
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  {receiptIsPdf ? (
                    <FileText size={13} aria-hidden />
                  ) : (
                    <ImageIcon size={13} aria-hidden />
                  )}
                  <span>Receipt & Items</span>
                  {receiptLines.length > 0 && (
                    <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.2 text-[10px] font-normal tabular-nums text-[var(--ink)]">
                      {receiptLines.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* ── Dialog Body ── */}
            {activeTab === "details" ? (
              <div className="mt-4 space-y-3">
                {/* Flagged Banner */}
                {row?.flagged && clearedFlagId !== row?.id ? (
                  <div
                    role="note"
                    className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/[0.1] px-4 py-3"
                  >
                    <TriangleAlert
                      size={16}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-[var(--warning)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--warning)]">
                        Receipt date predates the budget issuance date
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--warning)]/90">
                        This receipt is dated before the budget was issued to
                        the employee. Please verify details before approving.
                      </p>
                      <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-[var(--warning)]/20 pt-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFlagConfirmOpen(true)}
                          disabled={approving}
                          className="h-7 rounded-full border-[var(--warning)]/40 px-3 text-xs hover:bg-[var(--warning)]/15"
                        >
                          <ShieldCheck size={14} aria-hidden />
                          Approve flag
                        </Button>
                      </div>
                      {approveError ? (
                        <p
                          role="alert"
                          className="mt-1 text-[11px] font-medium text-[var(--danger)]"
                        >
                          {approveError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : clearedFlagId === row?.id ? (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
                  >
                    <ShieldCheck
                      size={16}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-700">
                        Approved by admin
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-emerald-700/90">
                        Flag cleared — this expense is no longer marked for
                        review.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Amount Hero Card */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Amount
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                      {formatMoney(row?.amount)}
                    </p>
                    <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
                      {[row?.category, methodLabel(row?.method)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ExpenseStatusBadge
                    status={row?.status}
                    className="shrink-0"
                  />
                </div>

                {/* Details Section */}
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
                  {/* Vendor / Description */}
                  <div className="border-b border-[var(--border)] py-2.5 first:pt-0">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Vendor / Description
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)] normal-case">
                      {vendorName || row?.description || "—"}
                    </p>
                    {vendorName &&
                    row?.description &&
                    vendorName !== row.description ? (
                      <p className="mt-0.5 break-words text-xs text-[var(--ink-muted)]">
                        {row.description}
                      </p>
                    ) : null}
                  </div>

                  {/* Date, Time, Method */}
                  <div className="grid grid-cols-3 gap-3 border-b border-[var(--border)] py-2.5">
                    <div className="min-w-0">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Date
                      </p>
                      <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                        {formatDate(row?.date)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Time
                      </p>
                      <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                        {formatTime(row?.date || row?.timeDate)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Method
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--ink)]">
                        <span className="text-[var(--ink-muted)]">
                          {getMethodIcon(row?.method)}
                        </span>
                        <span className="truncate">
                          {methodLabel(row?.method)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Category & Source of Funds */}
                  {(row?.category || referenceLabel) && (
                    <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] py-2.5">
                      {row?.category ? (
                        <div className="min-w-0">
                          <p className="type-eyebrow text-[var(--ink-muted)]">
                            Category
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                            {row.category}
                          </p>
                        </div>
                      ) : null}
                      {referenceLabel ? (
                        <div className="min-w-0">
                          <p className="type-eyebrow text-[var(--ink-muted)]">
                            Source of Funds
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                            {referenceLabel}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Submitted By */}
                  <div className="border-b border-[var(--border)] py-2.5">
                    <p className="mb-2 type-eyebrow text-[var(--ink-muted)]">
                      Submitted By
                    </p>
                    <CreatorRow row={row} />
                  </div>

                  {/* Review Notes (for draft) or Notes */}
                  {row?.status === "draft" ? (
                    <div className="pt-2">
                      <ReviewNotesCard row={row} />
                    </div>
                  ) : row?.notes ? (
                    <div className="pt-2">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Notes
                      </p>
                      <p className="mt-1 break-words text-sm text-[var(--ink)]">
                        {row.notes}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Receipt Quick Preview Link Card */}
                {hasReceipt && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("receipt")}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 text-left transition-colors hover:bg-[var(--surface-2)]/90"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                        {receiptIsPdf ? (
                          <FileText size={16} />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          {receiptIsPdf
                            ? "PDF receipt document attached"
                            : "Receipt image attached"}
                        </p>
                        <p className="text-[11px] text-[var(--ink-muted)]">
                          {receiptLines.length > 0
                            ? `${receiptLines.length} itemized lines scanned · View receipt`
                            : "Click to inspect receipt document"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-normal text-[var(--ink)] shadow-2xs">
                      View receipt →
                    </span>
                  </button>
                )}
              </div>
            ) : (
              /* ── Receipt & Scanned Items View ── */
              <div className="mt-4 space-y-4">
                <section
                  aria-label="Receipt document"
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-2.5">
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--ink)]">
                      <ImageIcon size={13} aria-hidden className="shrink-0" />
                      <span className="truncate">Receipt preview</span>
                      {zoomLevel !== 1 ? (
                        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent-strong)]">
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
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                      >
                        <ZoomOut size={13} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={zoomReset}
                        disabled={zoomLevel === 1}
                        title="Reset zoom"
                        aria-label="Reset receipt zoom"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                      >
                        <RotateCcw size={12} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoomLevel >= 2.2}
                        title="Zoom in"
                        aria-label="Zoom in receipt image"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                      >
                        <ZoomIn size={13} aria-hidden />
                      </button>
                      <span
                        aria-hidden
                        className="mx-1 h-3 w-px bg-[var(--border)]"
                      />
                      <button
                        type="button"
                        onClick={() => openReceiptFile(receiptUrl)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)] transition-opacity hover:opacity-90"
                      >
                        <Maximize2 size={12} aria-hidden />
                        Full size
                      </button>
                    </div>
                  </div>

                  {canPreviewImage ? (
                    <div className="scrollbar-slim relative max-h-[460px] min-h-[240px] overflow-auto bg-[var(--surface-2)]/30 p-3 sm:p-4">
                      <img
                        src={receiptUrl}
                        alt="Scanned receipt"
                        onError={() => setFailedUrl(receiptUrl)}
                        style={{ transform: `scale(${zoomLevel})` }}
                        className="mx-auto block w-auto max-w-full rounded-lg bg-white object-contain shadow-md transition-transform duration-150"
                      />
                    </div>
                  ) : receiptUrl ? (
                    <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 bg-[var(--surface-2)]/40 p-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                        {receiptIsPdf ? (
                          <FileText size={24} aria-hidden />
                        ) : (
                          <ImageIcon size={24} aria-hidden />
                        )}
                      </span>
                      <div className="max-w-[280px] space-y-1">
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {receiptIsPdf
                            ? "PDF document receipt"
                            : "Receipt attachment"}
                        </p>
                        <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
                          {receiptIsPdf
                            ? "This expense is linked to a PDF file."
                            : "Open the original file to view it."}
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
                    <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 p-6 text-center">
                      <ReceiptText
                        size={22}
                        className="text-[var(--ink-muted)]"
                      />
                      <p className="text-xs text-[var(--ink-muted)]">
                        No receipt image attached
                      </p>
                    </div>
                  )}
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
            )}

            {/* ── Dialog Footer ── */}
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
              {hasReceipt && activeTab === "receipt" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  ← Back to overview
                </button>
              ) : (
                <span />
              )}
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

      {/* Confirmation Dialog for Approving Flagged Expense */}
      <ConfirmActionDialog
        open={flagConfirmOpen}
        icon={<ShieldCheck size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Approve this flagged expense?"
        description="This clears the review flag and marks the receipt as approved. Only approve after the receipt details and legitimacy have been verified."
        summary={confirmSummary}
        cancelLabel="Keep flagged"
        confirmLabel="Yes, approve"
        confirmVariant="accent"
        pendingLabel="Approving…"
        pending={approving}
        onCancel={() => setFlagConfirmOpen(false)}
        onConfirm={handleApproveFlag}
      />
    </AnimatePresence>,
    document.body,
  );
};

export default ExpenseDetailsModal;
