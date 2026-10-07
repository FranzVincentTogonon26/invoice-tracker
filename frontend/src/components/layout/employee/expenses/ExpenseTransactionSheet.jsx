import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Eye, Flag, Trash2, X } from "lucide-react";
import { cn, formatDate, formatMoney, formatTime, methodLabel } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  expenseConfigFor,
  hasExpenseReceipt,
  isExpenseActionable,
  isExpenseFlagged,
} from "@/lib/expenseLedger";
import { expensesApi } from "../../../../api/expenses";
import { Button } from "../../../ui/Button";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";

export function ExpenseTransactionSheet({
  row,
  pending,
  onClose,
  onView,
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
              onView={onView}
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
  onView,
  onDelete,
  onUpdate,
  canEdit = true,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(title || "");
  const textareaRef = useRef(null);

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
      </div>
      <div className="mt-4 space-y-3">
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
                Dated before the first budget issued to you — an admin needs to
                approve it.
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
                  actionable && !pending && "cursor-pointer hover:underline",
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
                {[row.category, methodLabel(row.method)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <ExpenseStatusBadge status={row.status} className="shrink-0" />
          </div>
        </div>
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

export default ExpenseTransactionSheet;
