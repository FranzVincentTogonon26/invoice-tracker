import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CircleCheck, Loader2, Save } from "lucide-react";
import { Button } from "../../ui/Button";
import { formatDate, formatMoney } from "../../../lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// Pre-save review for AddExpenses: "are all data correct?" — lists every
// touched line with its total and funding source before the request fires.
// Confirm runs the same save (which re-validates everything); cancel returns
// to the form with the draft untouched.
const ConfirmSaveExpensesDialog = ({
  open,
  lines = [],
  total = 0,
  sourceLabel = "",
  backdatedCount = 0,
  firstIssuedLabel = "",
  saving = false,
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const reviewRef = useRef(null);

  useEffect(() => {
    if (open) reviewRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!saving) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, saving, onCancel]);

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
          key="save-expenses-confirm"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
            onClick={() => {
              if (!saving) onCancel?.();
            }}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={saving || undefined}
            onKeyDown={handleDialogKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto scrollbar-slim rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <CircleCheck size={20} aria-hidden />
            </div>

            <h2
              id={titleId}
              className="mt-4 font-display text-lg font-medium tracking-tight text-[var(--ink)]"
            >
              Are all data correct?
            </h2>

            <p
              id={descriptionId}
              className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
            >
              Review the lines below before confirming — saving writes them to
              the ledger and uploads the attached receipts.
            </p>

            <div className="scrollbar-slim mt-4 max-h-[240px] overflow-hidden overflow-y-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-[1]">
                  <tr className="bg-[var(--surface-2)]">
                    <th
                      scope="col"
                      className="w-9 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                    >
                      #
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                    >
                      Line
                    </th>
                    <th
                      scope="col"
                      className="w-[96px] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60 bg-[var(--surface)]">
                  {lines.map((line, index) => (
                    <tr
                      key={line.key ?? index}
                      className="transition-colors hover:bg-[var(--surface-2)]/40"
                    >
                      <td className="px-3 py-2.5 align-top text-xs tabular-nums text-[var(--ink-muted)]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="break-words text-[13px] font-medium leading-snug text-[var(--ink)]">
                          {line.description || `Expense item ${index + 1}`}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-[var(--ink-muted)]">
                          {line.category ? `${line.category} · ` : ""}
                          {formatDate(line.date)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top text-[13px] font-medium tabular-nums text-[var(--ink)]">
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-3 ring-1 ring-inset ring-[var(--accent)]/20">
              <div className="min-w-0">
                <p className="truncate text-xs text-[var(--ink-muted)]">
                  {sourceLabel || "Source of funds"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  {lines.length} {lines.length === 1 ? "line" : "lines"}
                </p>
              </div>
              <span className="shrink-0 font-display text-xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
                {formatMoney(total)}
              </span>
            </div>

            {backdatedCount > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--warning)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--warning)]">
                <AlertTriangle
                  size={14}
                  className="mt-px shrink-0"
                  aria-hidden
                />
                <span>
                  {backdatedCount} {backdatedCount === 1 ? "line" : "lines"}{" "}
                  {backdatedCount === 1 ? "is" : "are"} dated behind the first
                  budget issued
                  {firstIssuedLabel ? ` (${firstIssuedLabel})` : ""} —{" "}
                  {backdatedCount === 1 ? "it" : "they"} will be saved flagged.
                </span>
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                ref={reviewRef}
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                Review again
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={onConfirm}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : (
                  <Save size={13} aria-hidden />
                )}
                {saving ? "Saving…" : "Yes, save now"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ConfirmSaveExpensesDialog;
