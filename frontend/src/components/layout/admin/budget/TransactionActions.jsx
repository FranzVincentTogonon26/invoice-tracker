import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, CircleAlert, Flag, Loader2, RefreshCcw } from "lucide-react";
import { cn, formatMoney } from "../../../../lib/utils";
import { USER_ROLES } from "../../../../constants";
import { Button } from "../../../ui/Button";

// Statuses where cancelling a budget transaction is a valid action — the
// trigger stays disabled otherwise (and always for non-admin viewers).
const CANCELLABLE_STATUSES = ["closed", "pending", "added", "approved"];

// Admins get the full action set; employees can only inspect a transaction.
const canCancelTransaction = (status, role) =>
  role === USER_ROLES.ADMIN && CANCELLABLE_STATUSES.includes(status);

// Shared entrance/exit easing — the same curve BudgetModal uses, so both
// overlay styles animate consistently.
const DIALOG_EASE = [0.16, 1, 0.3, 1];

/**
 * Danger-tinted icon badge shared by both dialog variants.
 */
function DialogIcon({ children }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
      {children}
    </div>
  );
}

/**
 * Modal shell shared by both dialog variants: dimmed + blurred backdrop, a
 * centred panel with the app's spring-eased entrance, and destructive
 * `alertdialog` semantics (announced assertively by screen readers, with
 * the body copy wired up as its accessible description).
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
 * Row-level "cancel transaction" trigger. Opens a destructive-confirmation
 * dialog (or an "invalid request" dialog when the amount exceeds the
 * remaining budget); confirming calls `onAction("cancel", transaction)`,
 * which the parent wires to the backend (`budget.status -> 'cancelled'`)
 * plus a short undo window.
 */
export function TransactionActions({
  transaction,
  role = USER_ROLES.ADMIN,
  onAction,
  className,
  valueRemaining,
  pending = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const initialFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  const canCancel = canCancelTransaction(transaction.status, role);

  // A cancel attempt is invalid when the transaction amount exceeds the
  // remaining budget (cash on hand — the overview total minus issued funds,
  // passed by the parent as `valueRemaining`) — the trigger then opens an
  // error dialog instead of the confirmation flow. Guarded on
  // `valueRemaining != null` so while the overview is loading (or a caller
  // doesn't pass a value) the check is simply skipped and never fires on
  // missing data.
  const amount = Number(transaction.amount) || 0;
  // `valueRemaining` arrives as a RAW number — the display layer formats
  // it. `Number.isFinite` makes a malformed value skip the check entirely
  // instead of silently parsing to 0 and blocking every cancel attempt
  // with a bogus "exceeds the budget" error.
  const remaining = Number(valueRemaining);
  const exceedsTotal =
    valueRemaining != null && Number.isFinite(remaining) && amount > remaining;

  const closeDialog = useCallback(() => {
    // Don't dismiss while the cancel request is in flight — the dialog is
    // the only signal that something is happening.
    if (pending) return;
    setOpen(false);
    triggerRef.current?.focus();
  }, [pending]);

  // Move focus into the dialog when it opens — the Close button for the
  // invalid-request dialog, the confirm button otherwise.
  useEffect(() => {
    if (open) initialFocusRef.current?.focus();
  }, [open]);

  // Lock page scroll behind the dialog so background content can't drift
  // while the modal is up.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
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
      {transaction.status === "cancelled" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={confirmRestore}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30",
            "text-[var(--ink-muted)] hover:bg-[var(--ink)]/14 hover:text-[var(--ink)]",
            className,
          )}
        >
          <RefreshCcw size={13} strokeWidth={2.5} aria-hidden />
          Restore
        </button>
      ) : transaction.status === "added" ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={!canCancel}
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30",
            "text-[var(--ink-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]",
            className,
          )}
        >
          <Ban size={13} strokeWidth={2.5} aria-hidden />
          Cancel
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 text-[var(--ink-muted)] bg-[var(--ink)]/14 text-[var(--ink)]">
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
          {open &&
            (exceedsTotal ? (
              <DialogShell
                key="invalid-request"
                titleId={titleId}
                descriptionId={descriptionId}
                onClose={closeDialog}
                onKeyDown={handleDialogKeyDown}
              >
                <DialogIcon>
                  <CircleAlert size={20} aria-hidden />
                </DialogIcon>
                <h2
                  id={titleId}
                  className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
                >
                  Invalid request
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
                >
                  Unable to proceed — the transaction amount{" "}
                  <span className="font-semibold text-[var(--ink)] tabular">
                    {formatMoney(amount)}
                  </span>{" "}
                  is greater than the remaining budget{" "}
                  <span className="font-semibold text-[var(--ink)] tabular">
                    {formatMoney(remaining)}
                  </span>
                  .
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    ref={initialFocusRef}
                    variant="outline"
                    size="sm"
                    onClick={closeDialog}
                  >
                    Close
                  </Button>
                </div>
              </DialogShell>
            ) : (
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
                  Cancel budget transaction?
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
                >
                  Are you sure you want to cancel this budget transaction? Its
                  status will be updated to{" "}
                  <span className="font-semibold text-[var(--danger)]">
                    cancelled
                  </span>{" "}
                  — you&apos;ll have a few seconds to undo afterwards.
                </p>

                {/* Transaction summary strip (mirrors BudgetModal's context
                    card) so admins confirm exactly what they're reversing. */}
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {transaction.description || "Budget transaction"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
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
                    Keep transaction
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
            ))}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
