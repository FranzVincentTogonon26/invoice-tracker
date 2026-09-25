import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "../../../ui/Button";

// Shared entrance/exit easing — the same curve the Budget actions dialogs use,
// so every confirmation in the admin area animates identically.
const DIALOG_EASE = [0.16, 1, 0.3, 1];

/**
 * Destructive-confirmation dialog for the ledger row actions ("Delete expense"
 * / "Cancel issuance"). Nothing is submitted until the admin answers "yes":
 * the menu only records which row was picked, and this dialog runs the
 * mutation on confirm — mirroring the Budget actions' alertdialog shell
 * (portal, body lock, focus trap, Escape to dismiss, pending lockout) so every
 * confirmation in the admin area behaves the same way.
 *
 * Focus lands on the destructive button (the Budget dialogs' choice); the
 * dialog is opened from a static table row, not from a form being edited.
 */
const ConfirmActionDialog = ({
  open,
  icon,
  title,
  description,
  summary,
  cancelLabel = "Keep",
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  pending = false,
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef(null);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Close on Escape while open. Capture phase + stopPropagation keeps
  // page-level Escape handlers from also firing. Ignored while a request is in
  // flight — the dialog must not be dismissed mid-submit.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!pending) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, pending, onCancel]);

  // Minimal focus trap — the dialog only contains two buttons.
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

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-action"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          {/* Backdrop click = dismiss (a no-op while the request is in flight). */}
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
            onClick={() => {
              if (!pending) onCancel?.();
            }}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={pending || undefined}
            onKeyDown={handleDialogKeyDown}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
              {icon}
            </div>

            <h2
              id={titleId}
              className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
            >
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
            >
              {description}
            </p>

            {summary}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={pending}
              >
                {cancelLabel}
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                variant="danger"
                onClick={onConfirm}
                disabled={pending}
              >
                {pending && (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                )}
                {pending ? pendingLabel : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ConfirmActionDialog;
