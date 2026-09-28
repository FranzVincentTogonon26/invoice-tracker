import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { HandCoins, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { abonoApi } from "../../../../api/abono";
import { formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { AbonoStatusBadge } from "./AbonoStatusBadge";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// The abono details portal opened from a ledger row (View abono / row click).
// The description edits on double-click — same flow as the mobile transaction
// sheet: PATCH /abono/:id/description, then `onUpdate` lets the page overlay
// the new text so the ledger flips without waiting for a refetch.
// Portalled to `document.body` (framer-motion leaves a transform on an
// ancestor card, which would otherwise trap this `fixed` overlay).
const EmployeeAbonoDetailsModal = ({ open, expense, onClose, onUpdate }) => {
  const titleId = useId();
  const textareaRef = useRef(null);
  const row = expense;
  // Non-null only while the description is being edited — the displayed text
  // derives from the row otherwise, so an updated row always shows through
  // without a sync effect.
  const [draft, setDraft] = useState(null);
  const isEditing = draft !== null;
  const description = draft ?? row?.description ?? "";

  useEffect(() => {
    if (!open) return undefined;
    // Escape closes the portal — but while a description edit is in flight it
    // must fall through to the textarea's own handler (capture listeners run
    // before the target, so bailing BEFORE stopPropagation is what lets the
    // edit cancel instead of the dialog closing).
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (draft !== null) return;
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, draft, onClose]);

  const close = useCallback(() => {
    setDraft(null);
    onClose?.();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = (draft ?? "").trim();
    if (!trimmed || trimmed === row?.description) {
      setDraft(null);
      return;
    }

    try {
      await abonoApi.updateDescription(row.id, trimmed);
      toast.success("Description updated");
      onUpdate?.({ ...row, description: trimmed });
      setDraft(null);
    } catch (err) {
      toast.error(err?.message || "Failed to update description");
      setDraft(null);
    }
  }, [draft, row, onUpdate]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setDraft(null);
    }
  };

  const handleDoubleClick = () => {
    if (isEditing) return;
    setDraft(row?.description || "");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <motion.div
          key="abono-details"
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
          onClick={close}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/35 backdrop-blur-md" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.24, ease: DIALOG_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--warning)]/15 text-[var(--warning)]">
                  <HandCoins size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                  >
                    Abono details
                  </h3>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                    {formatDate(row.created_at) || "—"}
                    {row.created_at ? ` · ${formatTime(row.created_at)}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close abono details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-4">
                <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Description
                      </p>
                      {isEditing ? (
                        <textarea
                          ref={textareaRef}
                          value={description}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          rows={2}
                          placeholder="Enter description"
                          className="mt-1.5 min-h-[44px] w-full resize-none rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                        />
                      ) : (
                        <p
                          onDoubleClick={handleDoubleClick}
                          className="mt-1.5 cursor-pointer break-words text-sm leading-snug text-[var(--ink)] hover:underline"
                          title="Double-click to edit the description"
                        >
                          {row.description || "—"}
                        </p>
                      )}
                      {!isEditing && (
                        <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
                          Double-click the description to edit it.
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="sr-only">Amount</p>
                      <p className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                        {formatMoney(toNumber(row.amount))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <AbonoStatusBadge status={row.status} />
                    {row.reference_label && (
                      <span
                        className="inline-flex max-w-full items-center rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold tracking-tight text-[var(--accent-strong)]"
                        title={row.reference_label}
                      >
                        <span className="truncate">{row.reference_label}</span>
                      </span>
                    )}
                  </div>
                </section>

                <section className="space-y-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Date recorded
                    </p>
                    <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
                      {formatDate(row.created_at)}
                      {row.created_at ? ` · ${formatTime(row.created_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Source of funds
                    </p>
                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                      {row.reference_label || "—"}
                    </p>
                  </div>
                  {row.date_settled && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Date settled
                      </p>
                      <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
                        {formatDate(row.date_settled)}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default EmployeeAbonoDetailsModal;