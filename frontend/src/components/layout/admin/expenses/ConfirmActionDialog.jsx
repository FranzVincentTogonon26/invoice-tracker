import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "../../../ui/Button";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
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

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

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
