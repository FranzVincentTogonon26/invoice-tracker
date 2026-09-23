import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, CircleAlert, EllipsisVertical, Flag, Loader2, RefreshCcw } from "lucide-react";
import { cn, formatMoney } from "../../../../lib/utils";
import { USER_ROLES } from "../../../../constants";
import { Button } from "../../../ui/Button";
import { LockBodyScroll } from "../../../../hooks/useLockBody";

const CANCELLABLE_STATUSES = ["closed", "pending", "added", "approved"];

const canCancelTransaction = (status, role) =>
  role === USER_ROLES.ADMIN && CANCELLABLE_STATUSES.includes(status);

const DIALOG_EASE = [0.16, 1, 0.3, 1];

function DialogIcon({ children }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
      {children}
    </div>
  );
}

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
 * Row-level actions for the Budget Transaction table. The trigger follows the
 * transaction status:
 *   - 'cancelled' → a "Restore" pill that calls `onAction("restore", …)`.
 *   - 'added'     → a "Cancel" pill (disabled for non-admins) that opens the
 *                   cancel dialog — or the "Invalid request" dialog when the
 *                   amount exceeds the remaining budget.
 *   - any other status → a non-interactive "Closed" chip.
 *
 * `variant="menu"` (used by the desktop `TransactionRow`) swaps the pills for
 * an `<EllipsisVertical>` kebab button that opens a portal dropdown carrying
 * the exact same status-driven logic; other statuses keep the Closed chip.
 * The default `inline` variant keeps the original pills (used by the mobile
 * `TransactionCard`).
 */
export function TransactionActions({
  transaction,
  role = USER_ROLES.ADMIN,
  onAction,
  className,
  valueRemaining,
  pending = false,
  variant = "inline",
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const initialFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  const canCancel = canCancelTransaction(transaction.status, role);

  const amount = Number(transaction.amount) || 0;
  const remaining = Number(valueRemaining);
  const exceedsTotal =
    valueRemaining != null && Number.isFinite(remaining) && amount > remaining;

  const closeDialog = useCallback(() => {
    if (pending) return;
    setOpen(false);
    triggerRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (open) initialFocusRef.current?.focus();
  }, [open]);

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

  // Kebab menu (variant="menu"): close on outside pointerdown, Escape, scroll
  // or resize, then hand focus back to the trigger — mirrors the behaviour of
  // ExpensesTable's RowActions menu.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => {
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    const handlePointerDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
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
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

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
    triggerRef.current?.focus();
  };

  const confirmRestore = () => {
    if (pending) return;
    onAction?.("restore", transaction);
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    setMenuOpen(true);
  };

  const closedChip = (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 text-[var(--ink-muted)] bg-[var(--ink)]/14 text-[var(--ink)]">
      <Flag size={13} strokeWidth={2.5} aria-hidden />
      Closed
    </span>
  );

  return (
    <>
      {variant === "menu" ? (
        transaction.status === "cancelled" ||
        transaction.status === "added" ? (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Transaction actions"
              disabled={
                pending ||
                (transaction.status === "added" && !canCancel)
              }
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
                "hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40",
                className,
              )}
            >
              <EllipsisVertical size={16} aria-hidden />
            </button>
            {menuOpen &&
              position &&
              createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Transaction actions"
                  style={{ top: position.top, right: position.right }}
                  className="fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
                >
                  {transaction.status === "cancelled" ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={pending}
                      onClick={() => {
                        setMenuOpen(false);
                        // Same path as the inline "Restore" pill:
                        // onAction("restore", transaction) + focus hand-back.
                        confirmRestore();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <RefreshCcw size={15} aria-hidden />
                      Restore transaction
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={pending || !canCancel}
                      onClick={() => {
                        setMenuOpen(false);
                        // Opens the existing dialog — "Invalid request" when
                        // the amount exceeds the remaining budget, otherwise
                        // the cancel-confirm dialog → onAction("cancel", …).
                        setOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Ban size={15} aria-hidden />
                      Cancel transaction
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </>
        ) : (
          closedChip
        )
      ) : transaction.status === "cancelled" ? (
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
      ) : transaction.status === "added" ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={!canCancel}
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
      ) : (
        closedChip
      )}

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
                  <span className="font-semibold text-[var(--ink)] tabular-nums">
                    {formatMoney(amount)}
                  </span>{" "}
                  is greater than the remaining budget{" "}
                  <span className="font-semibold text-[var(--ink)] tabular-nums">
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
                    <p className="truncate text-base font-semibold text-[var(--ink)]">
                      {transaction.description || "Budget transaction"}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                      Amount to reverse
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[var(--ink)] tabular-nums">
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
