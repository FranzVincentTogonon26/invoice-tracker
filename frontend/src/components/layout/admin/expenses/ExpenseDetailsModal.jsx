import { useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  ShieldCheck,
  Store,
  Tag,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
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

// Eyebrow label with a leading glyph — every detail card shares it so the
// rows read as one family.
const FieldLabel = ({ icon, children }) => (
  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
    {icon}
    <span>{children}</span>
  </p>
);

// One boxed detail row (label + value). `span` stretches it across the grid
// on `sm:` and up — single column on mobile.
const DetailItem = ({ icon, label, span = false, children }) => (
  <div
    className={cn(
      "min-w-0 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3",
      span && "sm:col-span-2",
    )}
  >
    <FieldLabel icon={icon}>{label}</FieldLabel>
    {children}
  </div>
);

const REVIEW_NOTES_MAX = 1000;

// Admin review trail — rendered ONLY for draft rows (replacing the read-only
// Notes / remarks card). A textarea pre-filled with the current notes plus an
// explicit Save, so suspicious lines can carry review comments. Saving writes
// the whole text (blank clears the trail); the button stays disabled until
// the text differs from what is stored.
const ReviewNotesCard = ({ row }) => {
  const { updateNotes } = useExpensesMutations();
  const saving = updateNotes.isPending;
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [committed, setCommitted] = useState(null);
  const [error, setError] = useState(null);

  // New expense selected while open → re-seed the editor from that row.
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
    <div className="min-w-0 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-2">
      <FieldLabel
        icon={
          <FileText
            size={13}
            aria-hidden
            className="shrink-0 text-[var(--ink-muted)]"
          />
        }
      >
        Review notes
      </FieldLabel>
      <p className="text-[11px] leading-snug text-[var(--ink-muted)]">
        Draft only — comment here when something looks suspicious. Saving
        overwrites the notes trail.
      </p>
      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={REVIEW_NOTES_MAX}
        disabled={saving}
        placeholder="e.g. Receipt total doesn't match the scanned items — verify with the employee."
        aria-label="Admin review notes"
        aria-invalid={Boolean(error) || undefined}
      />
      {error ? (
        <p
          role="alert"
          className="text-[11px] font-medium text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
          {notes.length}/{REVIEW_NOTES_MAX}
        </span>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
};

const CreatorRow = ({ row }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs">
    <EmployeeAvatar
      name={row?.employee}
      avatarUrl={row?.employeeAvatar}
      className="h-10 w-10 text-xs"
    />
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

// Green confirmation shown after the admin clears the flag — the
// "Approved by admin" label. Same card size/padding as the red notice so the
// layout doesn't shift, only the tone changes.
const ApprovedFlagNotice = () => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5"
  >
    <ShieldCheck
      size={16}
      aria-hidden
      className="mt-0.5 shrink-0 text-emerald-600"
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-emerald-700">Approved by admin</p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-700/90">
        Flag cleared — this expense is no longer marked for review.
      </p>
    </div>
  </div>
);

// ── Flagged notice + admin approval ─────────────────────────────────────
// Same red card the modal always rendered — only an action row is added
// inside it (button + "Action needed" hint). Approving asks for a
// confirmation first (ConfirmActionDialog) and only THEN PATCHes
// /expenses/:id/clear-flag (flag = 0), swapping this card for the green
// "Approved by admin" label. Rendered ONLY when row.flagged is truthy, so a
// non-flagged expense keeps the original design untouched.
const FlaggedNotice = ({
  expenseId,
  expense,
  onCleared,
  onConfirmOpenChange,
}) => {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState(null);

  // Keep the parent modal in the loop: its Escape handler must stand down
  // while this confirmation floats above it (see ExpenseDetailsModal).
  const setConfirm = (next) => {
    setConfirmOpen(next);
    onConfirmOpenChange?.(next);
  };

  const handleApprove = async () => {
    if (!expenseId || approving || approved) return;
    setApproving(true);
    setError(null);
    try {
      await expensesApi.clearFlag(expenseId);
      setApproved(true);
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
      onCleared?.(expenseId);
    } catch (err) {
      setError(err?.message || "Couldn’t approve flag. Try again.");
      // Close the dialog so the inline error on the notice stays visible.
      setConfirm(false);
    } finally {
      setApproving(false);
    }
  };

  if (approved) {
    return <ApprovedFlagNotice />;
  }

  // Expense recap inside the confirmation — same summary card the admin
  // ledger's confirm dialogs render, so the admin can verify WHICH receipt
  // they are approving before the flag is cleared.
  const summary = expense ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[var(--ink)]">
          {expense.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${expense.category || "Uncategorized"} · ${formatDate(expense.date)}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
        {formatMoney(expense.amount)}
      </span>
    </div>
  ) : null;

  return (
    <>
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
          <div className="mt-2.5 flex flex-row items-center justify-end gap-2 border-t border-[var(--danger)]/20 pt-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={approving || !expenseId}
              className="h-7 rounded-full px-3 text-xs"
            >
              <ShieldCheck size={16} aria-hidden />
              Approve
            </Button>
          </div>
          {error ? (
            <p
              role="alert"
              className="mt-1.5 text-[11px] font-medium text-[var(--danger)]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        icon={<ShieldCheck size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Approve this flagged expense?"
        description="This clears the review flag and marks the receipt as approved. Only approve after the receipt details and legitimacy have been verified."
        summary={summary}
        cancelLabel="Keep flagged"
        confirmLabel="Yes, approve"
        confirmVariant="accent"
        pendingLabel="Approving…"
        pending={approving}
        onCancel={() => setConfirm(false)}
        onConfirm={handleApprove}
      />
    </>
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
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
              Receipt items
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
  onFlagCleared,
}) => {
  const titleId = useId();
  const itemsRegionId = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Expense id whose flag was just approved in this session — keeps the green
  // "Approved by admin" label visible after the parent flips row.flagged to
  // false (otherwise the notice would unmount and the confirmation would flash
  // away). Reset per expense / per open below.
  const [clearedFlagId, setClearedFlagId] = useState(null);
  // True while the flag-approval confirmation floats above this modal — the
  // modal's Escape handler stands down so Escape closes only that dialog
  // (see FlaggedNotice's onConfirmOpenChange).
  const [flagConfirmOpen, setFlagConfirmOpen] = useState(false);
  const row = expense;

  // Reset the view (zoom level + items panel) on every open. Adjusting state
  // during render is the documented alternative to a setState-in-effect — the
  // same pattern BudgetModal / ReferencesModal use.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setZoomLevel(1);
    setItemsOpen(false);
    if (!open) {
      setClearedFlagId(null);
      setFlagConfirmOpen(false);
    }
  }
  // New expense selected while open → drop the previous approval label so a
  // non-flagged expense keeps the original design untouched.
  const [prevRowId, setPrevRowId] = useState(row?.id);
  if (prevRowId !== row?.id) {
    setPrevRowId(row?.id);
    setClearedFlagId(null);
    setFlagConfirmOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // The flag-approval confirmation owns Escape while it's open — let it
      // close just the dialog instead of tearing down this whole modal.
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
    <FlaggedNotice
      key={row?.id}
      expenseId={row?.id}
      expense={row}
      onCleared={(id) => {
        setClearedFlagId(id);
        onFlagCleared?.(id);
      }}
      onConfirmOpenChange={setFlagConfirmOpen}
    />
  ) : clearedFlagId && clearedFlagId === row?.id ? (
    <ApprovedFlagNotice />
  ) : null;

  const detailRows = (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      <DetailItem
        icon={
          <Calendar
            size={13}
            aria-hidden
            className="shrink-0 text-[var(--accent-strong)]"
          />
        }
        label="Expense date"
      >
        <p className="text-sm font-semibold text-[var(--ink)]">
          {formatDate(row?.date)}
          {row?.timeDate ? (
            <span className="font-normal text-[var(--ink-muted)]">
              {" "}
              · {formatTime(row?.timeDate)}
            </span>
          ) : null}
        </p>
      </DetailItem>

      {row?.receiptDate ? (
        <DetailItem
          icon={
            <CalendarClock
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
          label="Entry date"
        >
          <p className="text-sm font-semibold text-[var(--ink)]">
            {formatDate(row.timeDate)}
          </p>
        </DetailItem>
      ) : null}

      <DetailItem
        icon={
          <Wallet
            size={13}
            aria-hidden
            className="shrink-0 text-[var(--accent-strong)]"
          />
        }
        label="Payment method"
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
          <span className="text-[var(--ink-muted)]">
            {getMethodIcon(row?.method)}
          </span>
          {methodLabel(row?.method)}
        </p>
      </DetailItem>

      {row?.category ? (
        <DetailItem
          icon={
            <Tag
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
          label="Category"
        >
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {row.category}
          </p>
        </DetailItem>
      ) : null}

      {referenceLabel ? (
        <DetailItem
          icon={
            <Tag
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--accent-strong)]"
            />
          }
          label="Source of funds"
          span
        >
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {referenceLabel}
          </p>
        </DetailItem>
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

      {row?.status === "draft" ? (
        <ReviewNotesCard row={row} />
      ) : row?.notes ? (
        <DetailItem
          icon={
            <FileText
              size={13}
              aria-hidden
              className="shrink-0 text-[var(--ink-muted)]"
            />
          }
          label="Notes / remarks"
          span
        >
          <p className="break-words text-sm leading-relaxed text-[var(--ink)]">
            {row.notes}
          </p>
        </DetailItem>
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          <p className="mt-1.5 font-display text-3xl font-bold leading-none tracking-tight tabular-nums text-[var(--ink)] sm:text-4xl">
            {formatMoney(recordedTotal)}
          </p>
        </div>
        <ExpenseStatusBadge status={row?.status} className="mt-0.5 shrink-0" />
      </div>
    </div>
  );

  const receiptPreview = canPreviewImage ? (
    <div className="flex flex-col bg-[#0b100f]">
      {/* ── Viewer toolbar: zoom controls + open full size ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2">
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
      <div className="scrollbar-slim relative max-h-[560px] min-h-[280px] overflow-auto p-3 sm:min-h-[380px] sm:p-4 lg:max-h-[640px]">
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
    <div className="flex min-h-[280px] w-full flex-col items-center justify-center gap-4 bg-[var(--surface-2)]/50 p-6 text-center sm:min-h-[340px] sm:p-8">
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
    <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3 bg-[var(--surface-2)]/40 px-6 py-10 text-center sm:min-h-[300px]">
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
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--ink)]/45 backdrop-blur-md sm:items-center sm:p-5"
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
              "relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/15 sm:mx-3 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl",
              hasReceipt ? "max-w-[1120px]" : "max-w-[520px]",
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)]/70 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="font-display truncate text-base font-semibold tracking-tight text-[var(--ink)] sm:text-lg"
                  >
                    Expense details
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)] sm:text-sm">
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
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>

            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {hasReceipt ? (
                <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
                          <span className="hidden shrink-0 text-[11px] text-[var(--ink-muted)] sm:inline">
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
                    className="min-w-0 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/35 p-4 shadow-xs sm:p-5"
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

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)]/70 px-4 py-3.5 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="w-full rounded-full px-5 text-xs font-semibold sm:w-auto"
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
