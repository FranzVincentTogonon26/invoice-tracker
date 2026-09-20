import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Flag, Loader2, RefreshCcw } from "lucide-react";
import { cn, formatMoney } from "../../../../lib/utils";
import { Button } from "../../../ui/Button";
import { LockBodyScroll } from "../../../../hooks/useLockBody";

// Shared entrance/exit easing — the same curve BudgetModal / TransactionActions
// use, so every overlay style animates consistently.
const DIALOG_EASE = [0.16, 1, 0.3, 1];

/**
 * Danger-tinted icon badge shared by the confirmation dialog.
 */
function DialogIcon({ children }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
      {children}
    </div>
  );
}

/**
 * Modal shell: dimmed + blurred backdrop, a centred panel with the app's
 * spring-eased entrance, and destructive `alertdialog` semantics (announced
 * assertively by screen readers, with the body copy as its description).
 */
function DialogShell({
  titleId,
  descriptionId,
  pending,
  onClose,
  onKeyDown,
  children,
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: DIALOG_EASE }}
    >
      <LockBodyScroll />
      {/* Backdrop click = dismiss (a no-op while the request is in flight). */}
      <div
        className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending || undefined}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: DIALOG_EASE }}
        className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
/**
 * Row-level actions for the Budget Issued Transaction table. The trigger
 * follows the issuance status:
 *   - 'open'   → a "Cancel" trigger that opens a destructive-confirmation
 *                dialog; confirming calls `onAction("cancel", transaction)`.
 *   - 'cancel' → a "Restore" trigger that calls `onAction("restore", …)`
 *                directly (the issuance is put back to 'open').
 *   - any other status ('close') → a non-interactive "Closed" chip.
 */
export function IssuedTransactionActions({
  transaction,
  onAction,
  className,
  pending = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const initialFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  const amount = Number(transaction.amount) || 0;

  const closeDialog = useCallback(() => {
    // Don't dismiss while the request is in flight — the dialog is the only
    // signal that something is happening.
    if (pending) return;
    setOpen(false);
    triggerRef.current?.focus();
  }, [pending]);

  // Move focus into the dialog when it opens — the confirm button.
  useEffect(() => {
    if (open) initialFocusRef.current?.focus();
  }, [open]);

  // Close on Escape while open. Capture phase + stopPropagation keeps
  // page-level Escape handlers from also firing.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, closeDialog]);

  // Minimal focus trap — the dialog only contains one or two buttons.
  const handleDialogKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const buttons = Array.from(
      e.currentTarget.querySelectorAll("button"),
    ).filter((el) => !el.disabled);
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const confirmCancel = () => {
    if (pending) return;
    setOpen(false);
    onAction?.("cancel", transaction);
    // Hand focus back to the trigger so keyboard users don't land on <body>.
    triggerRef.current?.focus();
  };

  const confirmRestore = () => {
    if (pending) return;
    onAction?.("restore", transaction);
    // Hand focus back to the trigger so keyboard users don't land on <body>.
    triggerRef.current?.focus();
  };

  return (
    <>
      {transaction.status === "open" ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30",
            "text-[var(--ink-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]",
            className,
          )}
        >
          <Ban size={13} strokeWidth={2.5} aria-hidden />
          Cancel
        </button>
      ) : transaction.status === "cancel" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={confirmRestore}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30",
            "text-[var(--ink-muted)] hover:bg-[var(--ink)]/14 hover:text-[var(--ink)]",
            className,
          )}
        >
          <RefreshCcw size={13} strokeWidth={2.5} aria-hidden />
          Restore
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 text-[var(--ink-muted)] bg-[var(--ink)]/14 text-[var(--ink)]">
          <Flag size={13} strokeWidth={2.5} aria-hidden />
          Closed
        </span>
      )}
      {/* NOTE: the portal must NOT be a direct child of <AnimatePresence> —
          a portal is not a valid React element (isValidElement(portal) is
          false) so AnimatePresence silently drops it and the dialog never
          renders. Instead, the portal stays mounted and AnimatePresence
          tracks the keyed motion.div inside it. */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <DialogShell
              key="cancel-confirm"
              titleId={titleId}
              descriptionId={descriptionId}
              pending={pending}
              onClose={closeDialog}
              onKeyDown={handleDialogKeyDown}
            >
              <DialogIcon>
                <Ban size={20} aria-hidden />
              </DialogIcon>
              <h2
                id={titleId}
                className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
              >
                Cancel this budget issuance?
              </h2>
              <p
                id={descriptionId}
                className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
              >
                Are you sure you want to cancel this budget issuance? Its status
                will be updated to{" "}
                <span className="font-semibold text-[var(--danger)]">
                  cancelled
                </span>
                .
              </p>

              {/* Transaction summary strip so admins confirm exactly what
                  they're reversing. */}
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold text-[var(--ink)]">
                    {transaction.description || "Budget issuance"}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                    Amount to reverse
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[var(--ink)] tabular">
                  {formatMoney(amount)}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  disabled={pending}
                >
                  Keep issuance
                </Button>
                <Button
                  ref={initialFocusRef}
                  variant="danger"
                  onClick={confirmCancel}
                  disabled={pending}
                >
                  {pending && (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  )}
                  {pending ? "Cancelling…" : "Yes, cancel it"}
                </Button>
              </div>
            </DialogShell>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
