import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  Flag,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Trash2,
  X,
} from "lucide-react";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  expenseConfigFor,
  hasExpenseReceipt,
  isExpenseActionable,
  isExpenseFlagged,
} from "@/lib/expenseLedger";
import { expensesApi } from "../../../../api/expenses";
import { useExpenseDetail, useExpenses } from "../../../../hooks/useExpenses";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";
import { Button } from "../../../ui/Button";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";

// Premium staggered entrance: once the panel slides up, its inner sections
// rise in sequence (grabber → header → body → actions) with a soft
// rise-and-fade. Re-keyed per row so switching rows replays the sequence.
const sheetContentVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const sheetItemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

// In-sheet receipt pane — mirrors OverviewSheet's SheetReceiptView: slides
// in from the right over the details (and back out the same way) instead
// of opening a separate modal.
const receiptPaneTransition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
};

const receiptContentVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.14 },
  },
};

// Horizontal-only cascade for the receipt pane: every section travels
// right-to-left with a smooth glide — no vertical rise.
const receiptItemVariants = {
  hidden: { opacity: 0, x: 48 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

function SheetReceiptView({ row, onBack }) {
  const receiptUrl = row?.imageUrl ?? "";
  const receiptIsPdf = isReceiptPdf(receiptUrl);
  const canPreviewImage = Boolean(receiptUrl) && !receiptIsPdf;
  const [failedUrl, setFailedUrl] = useState(null);
  // Skeleton-first image: shimmer block until the file finishes loading so
  // the card never paints empty/broken mid-flight.
  const [imgLoaded, setImgLoaded] = useState(false);
  // Scanned line items load only while this pane is mounted.
  const {
    receiptItems,
    isLoading: linesLoading,
    isError: linesError,
    refetch: refetchLines,
  } = useExpenseDetail(row?.kind === "expense" ? row?.id : null);
  const lines = (receiptItems ?? []).map((item, index) => ({
    key: `${item?.id ?? "line"}-${index}`,
    description: String(item?.description ?? "").trim() || "Unnamed item",
    amount: Number(item?.amount) || 0,
  }));
  const itemsTotal = lines.reduce((sum, it) => sum + (it.amount || 0), 0);
  const showPreview = canPreviewImage && failedUrl !== receiptUrl;

  return (
    <motion.div
      variants={receiptContentVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={receiptItemVariants}
        className="sticky -top-5 z-10 -mx-4 bg-[var(--surface)]/90 px-4 py-5 rounded-t-3xl backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-medium leading-tight tracking-tight text-[var(--ink)]">
              Receipt
            </p>
            <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
              {formatDate(row?.date)}
              {row?.timeDate ? ` · ${formatTime(row.timeDate)}` : ""}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={receiptItemVariants}
        className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        {showPreview ? (
          <div className="bg-[var(--surface-2)]/30 p-2">
            <div className="relative overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10">
              {!imgLoaded && (
                <div
                  aria-hidden
                  className="h-56 w-full animate-pulse bg-[var(--surface-2)]"
                />
              )}
              <img
                src={receiptUrl}
                alt="Scanned receipt"
                onLoad={() => setImgLoaded(true)}
                onError={() => setFailedUrl(receiptUrl)}
                className={cn(
                  "block h-56 w-full bg-white object-cover",
                  !imgLoaded && "hidden",
                )}
              />
              {imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--ink)]/25">
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() => openReceiptFile(receiptUrl)}
                    className="gap-1.5 shadow-lg"
                  >
                    <Maximize2 size={12} aria-hidden />
                    {receiptIsPdf ? "Open PDF document" : "Full size"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {receiptIsPdf ? (
                <FileText size={22} aria-hidden />
              ) : (
                <ImageIcon size={22} aria-hidden />
              )}
            </span>
            <p className="text-xs text-[var(--ink-muted)]">
              {receiptUrl
                ? "Open the original file to view it."
                : "No receipt image attached"}
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        variants={receiptItemVariants}
        className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Scanned items
          </p>
          {lines.length > 0 && (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
              {lines.length}
            </span>
          )}
        </div>
        {linesLoading ? (
          <div
            role="status"
            aria-label="Loading receipt items"
            className="space-y-2 p-4"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-4 animate-pulse rounded bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : linesError ? (
          <div className="flex items-center gap-2 p-4">
            <p className="min-w-0 flex-1 text-xs font-medium text-[var(--danger)]">
              Couldn&apos;t load receipt items
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refetchLines()}
            >
              Retry
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <p className="p-4 text-center text-xs text-[var(--ink-muted)]">
            No itemized lines found
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]/60">
              {lines.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate text-[var(--ink)]">
                    {item.description}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
                    {formatMoney(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--accent)]/30 bg-[var(--accent-soft)]/60 px-4 py-3 text-xs">
              <span className="font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                Items total
              </span>
              <span className="font-display text-sm font-semibold tabular-nums text-[var(--accent-strong)]">
                {formatMoney(itemsTotal)}
              </span>
            </div>
          </>
        )}
      </motion.div>
      <div className="mt-3 ">
        <motion.div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBack}
          >
            <ArrowLeft size={15} aria-hidden />
            Back to view details
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ExpenseTransactionSheet({
  row,
  pending,
  onClose,
  onDelete,
  onUpdate,
  // Read-only rendering (Admin → Employee Details): drops the delete action
  // and disables inline description editing.
  canManage = true,
  canEdit = true,
}) {
  const sheetRef = useRef(null);
  const actionable = isExpenseActionable(row) && canManage;
  const meta = expenseConfigFor(row?.kind);
  const Icon = meta.Icon;
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
            transition={{ duration: 0.38, ease: PANEL_EASE }}
            className={cn(
              "relative max-h-[88dvh] w-full overflow-y-auto scrollbar-slim outline-none overscroll-contain",
              "rounded-t-[15px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover will-change-transform",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <ExpenseTransactionSheetBody
              row={row}
              meta={meta}
              Icon={Icon}
              title={title}
              actionable={actionable}
              hasReceipt={hasExpenseReceipt(row)}
              pending={pending}
              close={close}
              onDelete={onDelete}
              onUpdate={onUpdate}
              canEdit={canEdit}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ExpenseTransactionSheetBody({
  row,
  meta,
  Icon,
  title,
  actionable,
  hasReceipt,
  pending,
  close,
  onDelete,
  onUpdate,
  canEdit = true,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(title || "");
  const textareaRef = useRef(null);
  const qc = useQueryClient();
  const { categories = [] } = useExpenses();

  // Sync description when the parent hands down a new title (e.g. after a
  // save updates sheetRow). Adjusted during render — not in an effect — so
  // it never triggers a cascading render pass.
  const [prevTitle, setPrevTitle] = useState(title);
  if (title !== prevTitle) {
    setPrevTitle(title);
    if (!isEditing) setDescription(title || "");
  }

  const handleSave = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      return;
    }

    try {
      await expensesApi.updateDescription(row.id, trimmed);
      toast.success("Description updated");
      // Update the parent's sheetRow state
      onUpdate?.({ ...row, description: trimmed });
      setIsEditing(false);
    } catch (err) {
      toast.error(err?.message || "Failed to update description");
      setDescription(title);
      setIsEditing(false);
    }
  }, [row.id, description, title, onUpdate]);

  const handleBlur = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        setDescription(title);
        setIsEditing(false);
      }
    },
    [title, handleSave],
  );

  const handleDoubleClick = useCallback(() => {
    if (actionable && !pending) {
      setIsEditing(true);
      // Focus textarea after render
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [actionable, pending]);

  // ── Category quick editor ──────────────────────────────────────────
  // Double-click (double-tap on mobile) opens the category list; tapping a
  // category saves immediately, and clicking outside auto-saves the
  // highlighted pick (a no-op close when nothing changed). Same edit gate
  // as the description editor above — the server still locks
  // closed-holding rows.
  const [catOpen, setCatOpen] = useState(false);
  const [catSelected, setCatSelected] = useState(null);
  const [catSaving, setCatSaving] = useState(false);
  const catWrapRef = useRef(null);
  const catSelectedRef = useRef(null);
  // Guards the outside-click auto-save against the emulated `mousedown` that
  // follows the opening tap on touch devices — without it, the second tap
  // of a double-tap opens the picker and its ghost click instantly closes
  // it again.
  const catOpenedAtRef = useRef(0);

  // The ledger row carries the category name (and sometimes the id) — match
  // the name back to an id so the current pick highlights correctly.
  const resolveCategoryId = useCallback(
    (target) => {
      const direct = target?.categoryId ?? target?.category_id ?? null;
      if (direct) return direct;
      const name = String(target?.category ?? target?.category_name ?? "")
        .trim()
        .toLowerCase();
      if (!name) return null;
      return (
        categories.find(
          (c) =>
            String(c.category_name ?? "")
              .trim()
              .toLowerCase() === name,
        )?.category_id ?? null
      );
    },
    [categories],
  );

  const openCatPicker = useCallback(() => {
    if (!actionable || pending || catSaving) return;
    const current = resolveCategoryId(row);
    catSelectedRef.current = current;
    catOpenedAtRef.current = Date.now();
    setCatSelected(current);
    setCatOpen(true);
  }, [actionable, pending, catSaving, resolveCategoryId, row]);

  const persistCatSelection = useCallback(async () => {
    const next = catSelectedRef.current;
    const current = resolveCategoryId(row);
    if ((next ?? null) === (current ?? null)) {
      setCatOpen(false);
      return;
    }
    setCatSaving(true);
    try {
      const data = await expensesApi.updateCategory(row.id, next ?? null);
      const savedName =
        data?.expense?.category_name ??
        categories.find((c) => c.category_id === next)?.category_name ??
        "";
      toast.success("Category updated");
      onUpdate?.({
        ...row,
        category: savedName || "",
        category_name: savedName || "",
        categoryId: next ?? null,
        category_id: next ?? null,
      });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
    } catch (err) {
      toast.error(err?.message || "Couldn't update category");
    } finally {
      setCatSaving(false);
      setCatOpen(false);
    }
  }, [row, categories, resolveCategoryId, onUpdate, qc]);

  // Always call the latest persist (onUpdate identity changes per render).
  const persistCatRef = useRef(null);
  useEffect(() => {
    persistCatRef.current = persistCatSelection;
  });

  // Clicking outside auto-saves the highlighted pick.
  useEffect(() => {
    if (!catOpen) return undefined;
    const onPointerDown = (e) => {
      // Ignore presses right after opening (the ghost click behind a
      // double-tap) — only genuine outside taps auto-save.
      if (Date.now() - catOpenedAtRef.current < 500) return;
      if (!catWrapRef.current?.contains(e.target)) persistCatRef.current?.();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [catOpen]);

  const pickCategory = (id) => {
    if (catSaving) return;
    catSelectedRef.current = id ?? null;
    setCatSelected(id ?? null);
    persistCatRef.current?.();
  };

  const catOptionClass = (isSelected) =>
    cn(
      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-50",
      isSelected
        ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]"
        : "text-[var(--ink)] hover:bg-[var(--surface-2)]",
    );

  // In-sheet receipt pane — slides in from the right over the details
  // instead of opening a separate modal. Resets whenever another row opens.
  const [receiptPaneOpen, setReceiptPaneOpen] = useState(false);
  const [prevBodyRowId, setPrevBodyRowId] = useState(row?.id);
  if (row?.id !== prevBodyRowId) {
    setPrevBodyRowId(row?.id);
    setReceiptPaneOpen(false);
    setCatOpen(false);
  }

  // Escape steps back out of the receipt pane first (registered before the
  // sheet-level handler, so stopping propagation keeps the sheet open).
  useEffect(() => {
    if (!receiptPaneOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setReceiptPaneOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [receiptPaneOpen]);

  return (
    <AnimatePresence mode="wait">
      {receiptPaneOpen ? (
        <motion.div
          key="expense-sheet-receipt"
          initial={{ x: "100%", opacity: 0 }}
          animate={{
            x: "0%",
            opacity: 1,
            transition: { ...receiptPaneTransition, delay: 0.06 },
          }}
          exit={{
            x: "100%",
            opacity: 0,
            transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] },
          }}
        >
          <SheetReceiptView
            row={row}
            onBack={() => setReceiptPaneOpen(false)}
          />
        </motion.div>
      ) : (
        <motion.div
          key={row?.id ?? "expense-sheet-content"}
          variants={sheetContentVariants}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, x: "-40%", transition: { duration: 0.25 } }}
        >
          <motion.div
            aria-hidden
            variants={sheetItemVariants}
            className="mx-auto h-1.5 w-10 rounded-full bg-[var(--ink-muted)]/25"
          />
          <motion.div
            variants={sheetItemVariants}
            className="flex items-center gap-3 pt-4"
          >
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
              <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                Expense details
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
          </motion.div>
          <motion.div variants={sheetItemVariants} className="mt-4 space-y-3">
            {isExpenseFlagged(row) && (
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
                    Dated before the first budget issued to you — an admin needs
                    to approve it.
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
              <div className="border-b border-[var(--border)] py-3">
                <div className="flex items-center">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    Description
                  </p>
                  {canEdit && (
                    <span className="ml-2 text-[10px] text-[var(--ink-muted)]">
                      Double-click to edit
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="mt-1.5 w-full min-h-[44px] rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
                    placeholder="Enter description"
                  />
                ) : (
                  <p
                    onDoubleClick={canEdit ? handleDoubleClick : undefined}
                    onTouchEnd={
                      canEdit
                        ? (e) => {
                            // Handle double tap on mobile
                            const now = Date.now();
                            if (
                              e.target.dataset.lastTap &&
                              now - e.target.dataset.lastTap < 300
                            ) {
                              handleDoubleClick();
                            }
                            e.target.dataset.lastTap = now;
                          }
                        : undefined
                    }
                    className={cn(
                      "mt-1.5 text-sm text-[var(--ink)] normal-case",
                      actionable &&
                        !pending &&
                        "cursor-pointer hover:underline",
                    )}
                  >
                    {title || "—"}
                  </p>
                )}
              </div>
              <div className="flex gap-3 items-center justify-between pt-3">
                <div className="min-w-0">
                  <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
                  <p className="mt-1 font-display text-2xl font-medium leading-none tracking-tight tabular-nums text-[var(--ink)]">
                    {formatMoney(row.amount)}
                  </p>
                  <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
                    {methodLabel(row.method)}
                  </p>
                </div>
                <ExpenseStatusBadge status={row.status} className="shrink-0" />
              </div>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <div className="flex items-center">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    Category
                  </p>
                  {canEdit && !catOpen && (
                    <span className="ml-2 text-[10px] text-[var(--ink-muted)]">
                      Double-click to edit
                    </span>
                  )}
                  {catSaving && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[var(--ink-muted)]">
                      <Loader2 size={11} aria-hidden className="animate-spin" />
                      Saving…
                    </span>
                  )}
                </div>
                {catOpen ? (
                  <div
                    ref={catWrapRef}
                    className="mt-1.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <div
                      role="listbox"
                      aria-label="Expense category"
                      className="scrollbar-slim max-h-[180px] overflow-y-auto p-1"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={catSelected == null}
                        onClick={() => pickCategory(null)}
                        disabled={catSaving}
                        className={catOptionClass(catSelected == null)}
                      >
                        <span className="truncate">Uncategorized</span>
                        {catSelected == null && (
                          <Check size={13} aria-hidden className="shrink-0" />
                        )}
                      </button>
                      {(categories ?? []).map((cat) => {
                        const isSelected = catSelected === cat.category_id;
                        return (
                          <button
                            key={cat.category_id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => pickCategory(cat.category_id)}
                            disabled={catSaving}
                            className={catOptionClass(isSelected)}
                          >
                            <span className="truncate">
                              {cat.category_name}
                            </span>
                            {isSelected && (
                              <Check
                                size={13}
                                aria-hidden
                                className="shrink-0"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p
                    onDoubleClick={canEdit ? openCatPicker : undefined}
                    onTouchEnd={
                      canEdit
                        ? (e) => {
                            // Handle double tap on mobile
                            const now = Date.now();
                            if (
                              e.target.dataset.lastTap &&
                              now - e.target.dataset.lastTap < 300
                            ) {
                              openCatPicker();
                            }
                            e.target.dataset.lastTap = now;
                          }
                        : undefined
                    }
                    className={cn(
                      "mt-1 truncate text-sm font-medium text-[var(--ink)]",
                      actionable &&
                        !pending &&
                        "cursor-pointer hover:underline",
                    )}
                  >
                    {row.category || "Uncategorized"}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
          {actionable && (
            <motion.div variants={sheetItemVariants} className="mt-4 space-y-2">
              {hasReceipt ? (
                <Button
                  type="button"
                  variant="accent"
                  className="w-full"
                  onClick={() => setReceiptPaneOpen(true)}
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
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ExpenseTransactionSheet;
