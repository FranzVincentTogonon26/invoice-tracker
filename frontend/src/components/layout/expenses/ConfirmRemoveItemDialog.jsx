import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";
import { formatDate, formatMoney } from "../../../lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const ConfirmRemoveItemDialog = ({
  open,
  line,
  lineNumber,
  categoryName,
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const keepRef = useRef(null);
  const scannedDraft = Boolean(line?.receiptId && line?.receiptLocal);
  const storedReceipt = Boolean(line?.receiptId && !line?.receiptLocal);

  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onCancel]);

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
          key="remove-line-confirm"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={handleDialogKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
              <Trash2 size={20} aria-hidden />
            </div>

            <h2
              id={titleId}
              className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
            >
              Remove expense line {lineNumber}?
            </h2>

            <p
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
            >
              The line is dropped from this draft and the total updates right
              away. Nothing is deleted from the database until you save.
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[var(--ink)]">
                  {line?.description?.trim() || `Expense item ${lineNumber}`}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {categoryName ? `${categoryName} · ` : ""}
                  {formatDate(line?.date)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(line?.totalAmount)}
              </span>
            </div>

            {scannedDraft && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--danger)]">
                <Sparkles size={14} className="mt-px shrink-0" aria-hidden />
                <span>
                  The scanned receipt parked for this line is discarded too —
                  scan it again if you still need it.
                </span>
              </div>
            )}

            {storedReceipt && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--surface-2)]/60 px-3.5 py-2.5 text-xs leading-snug text-[var(--ink-muted)]">
                <ImagePlus
                  size={14}
                  className="mt-px shrink-0 text-[var(--accent-strong)]"
                  aria-hidden
                />
                <span>
                  The uploaded receipt stays in your receipts — only this draft
                  line is dropped.
                </span>
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                ref={keepRef}
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Keep
              </Button>
              <Button type="button" variant="danger" onClick={onConfirm}>
                <Trash2 size={13} aria-hidden />
                Remove line
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ConfirmRemoveItemDialog;
