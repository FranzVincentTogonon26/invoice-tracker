import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { BadgeCheck, Check, CheckCircle2, Loader2, TriangleAlert, Wallet, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { cn, formatDate, formatMoney } from "../../../../lib/utils";
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import { useAbonoMutations } from "../../../../hooks/useAbono";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// Round to centavos so the preview reconciles with the money the backend
// stores and the dashboard totals return (same rule every overview model
// uses).
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

// "Settle Abono" dialog — the employee checks the OPEN rows they were
// reimbursed for, the projected remaining balance (balance − checked) updates
// live, and "Confirm Settle" asks for a confirmation before the API flips each
// checked row to 'settled' + stamps `date_settled`. A selection the remaining
// balance can't cover is blocked here AND re-checked server-side (the
// insufficient-balance notice). Portalled to `document.body` like the rest of
// the app's dialogs (the page sits inside an animated framer-motion card
// whose transform would otherwise trap this `fixed` overlay).
const SettleAbonoModal = ({
  open,
  onClose,
  openRows = [],
  totalBalance = 0,
}) => {
  const titleId = useId();
  const [checked, setChecked] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { settle } = useAbonoMutations();
  const pending = settle.isPending;

  // Only OPEN rows ever reach the list — the page may hand over every row.
  const rows = useMemo(
    () => openRows.filter((row) => row?.status === "open"),
    [openRows],
  );

  // Total of ALL open abono — a fixed figure: it never shrinks as boxes get
  // checked (only the projected balance below reacts to the selection).
  const openTotal = useMemo(
    () =>
      toMoney(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)),
    [rows],
  );

  const checkedRows = useMemo(
    () => rows.filter((row) => checked.has(row.id)),
    [rows, checked],
  );
  const selectedTotal = useMemo(
    () =>
      toMoney(
        checkedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      ),
    [checkedRows],
  );

  const balance = toMoney(totalBalance);
  const projected = toMoney(balance - selectedTotal);
  const insufficient = selectedTotal > balance;
  const hasSelection = checkedRows.length > 0;

  const close = useCallback(() => {
    if (pending) return;
    onClose?.();
  }, [pending, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // The confirmation floats above this dialog and owns Escape while open.
      if (confirmOpen) return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, close, confirmOpen]);

  const toggleRow = (id) => {
    if (pending) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSettle = async () => {
    if (!hasSelection || insufficient || pending) return;
    try {
      await settle.mutateAsync(checkedRows.map((row) => row.id));
      toast.success(
        checkedRows.length === 1
          ? "Abono settled"
          : `${checkedRows.length} abono settled`,
      );
      setConfirmOpen(false);
      onClose?.();
    } catch (err) {
      // Keep this dialog (and the selection) open so the error reads inline
      // and the employee can adjust the checked rows and retry.
      setConfirmOpen(false);
      toast.error(err?.message || "Couldn't settle abono");
    }
  };

  const confirmSummary = (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {checkedRows.length} selected
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          Remaining after settle: {formatMoney(projected)}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(selectedTotal)}
      </span>
    </div>
  );

  return createPortal(
    <>
      <AnimatePresence
        // Fires once the closed dialog has finished fading out — the selection
        // resets here, so the next open always starts clean without an effect.
        onExitComplete={() => {
          setChecked(new Set());
          setConfirmOpen(false);
        }}
      >
        {open && (
        <motion.div
          key="settle-abono"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/45 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.26, ease: DIALOG_EASE }}
            className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-hover ring-1 ring-white/10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/70,transparent)]"
            />
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/40 px-6 py-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-card ring-1 ring-[var(--accent)]/25"
                >
                  <BadgeCheck size={19} />
                </span>
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="font-display truncate text-lg font-medium tracking-tight text-[var(--ink)]"
                  >
                    Settle Abono
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    Check the abono you were reimbursed for.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                aria-label="Close settle abono"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            {/* ── Body ── */}
            <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
              {/* Centre: what is left, with the checked total deducted live. */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border px-4 py-6 text-center transition-colors",
                  insufficient
                    ? "border-[var(--danger)]/40 bg-[var(--danger)]/[0.07]"
                    : "border-[var(--accent)]/25 bg-[linear-gradient(160deg,var(--accent-soft)_0%,transparent_70%)]",
                )}
              >
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  Remaining balance
                </p>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={projected}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: DIALOG_EASE }}
                    className={cn(
                      "mt-2 font-display text-4xl font-medium leading-none tracking-tight tabular-nums",
                      insufficient
                        ? "text-[var(--danger)]"
                        : "text-[var(--ink)]",
                    )}
                  >
                    {formatMoney(projected)}
                  </motion.p>
                </AnimatePresence>
                {hasSelection && (
                  <p className="mt-2.5 text-xs tabular-nums text-[var(--ink-muted)]">
                    {formatMoney(balance)} − {formatMoney(selectedTotal)}{" "}
                    checked
                  </p>
                )}
              </div>

              {/* Open abono total stays fixed; Checked tracks the selection. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3.5 text-center shadow-xs">
                  <p className="flex items-center justify-center gap-1.5 type-eyebrow text-[var(--ink-muted)]">
                    <Wallet
                      size={12}
                      aria-hidden
                      className="text-[var(--accent-strong)]"
                    />
                    Open abono
                  </p>
                  <p className="mt-1.5 font-display text-xl font-medium leading-none tracking-tight tabular-nums text-[var(--ink)]">
                    {formatMoney(openTotal)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium tabular-nums text-[var(--ink-muted)]">
                    {rows.length} {rows.length === 1 ? "record" : "records"}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-2xl border px-3.5 py-3.5 text-center shadow-xs transition-colors",
                    hasSelection
                      ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/40"
                      : "border-[var(--border)] bg-[var(--surface-2)]/60",
                  )}
                >
                  <p className="flex items-center justify-center gap-1.5 type-eyebrow text-[var(--ink-muted)]">
                    <CheckCircle2
                      size={12}
                      aria-hidden
                      className="text-[var(--accent-strong)]"
                    />
                    Checked
                  </p>
                  <p className="mt-1.5 font-display text-xl font-medium leading-none tracking-tight tabular-nums text-[var(--ink)]">
                    {formatMoney(selectedTotal)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium tabular-nums text-[var(--ink-muted)]">
                    {checkedRows.length} selected
                  </p>
                </div>
              </div>

              {/* Server-side rule, previewed client-side. */}
              {insufficient && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3"
                >
                  <TriangleAlert
                    size={14}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-[var(--danger)]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--danger)]">
                      Insufficient balance
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--danger)]/90">
                      Cannot proceed your request due to insufficient balance —
                      the checked abono is more than what remains.
                    </p>
                  </div>
                </div>
              )}

              {/* OPEN abono list — checkbox on the right of each row. */}
              <div className="space-y-2">
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  Open abono
                </p>
                {rows.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-3 text-center text-xs text-[var(--ink-muted)]">
                    Nothing to settle — every abono is already settled.
                  </p>
                ) : (
                  rows.map((row) => {
                    const isChecked = checked.has(row.id);
                    return (
                      <label
                        key={row.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-xs transition-all",
                          isChecked
                            ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]/50 shadow-card ring-1 ring-[var(--accent)]/20"
                            : "border-[var(--border)] bg-[var(--surface-2)]/60 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)]",
                          pending
                            ? "cursor-not-allowed opacity-70"
                            : "cursor-pointer",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-[var(--ink)]">
                            {row.description || "Abono"}
                            <span className="font-normal text-[var(--ink-muted)]">
                              {" "}
                              · {formatDate(row.date)}
                              {row.reference_label
                                ? ` · ${row.reference_label}`
                                : ""}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-display text-sm font-medium tabular-nums text-[var(--ink)]">
                            {formatMoney(row.amount)}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRow(row.id)}
                            disabled={pending}
                            aria-label={`Check ${row.description || "abono"}`}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all",
                              isChecked
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-card"
                                : "border-[var(--border)] bg-[var(--surface)] text-transparent",
                            )}
                          >
                            <Check
                              size={13}
                              strokeWidth={3}
                              className={cn(
                                "transition-transform duration-150",
                                isChecked ? "scale-100" : "scale-50",
                              )}
                            />
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={pending}
                className="rounded-full px-5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={() => setConfirmOpen(true)}
                disabled={pending || !hasSelection || insufficient}
                className="rounded-full px-5 shadow-card"
                title={
                  insufficient
                    ? "Cannot proceed your request due to insufficient balance"
                    : undefined
                }
              >
                {pending && (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                )}
                {pending ? "Settling…" : "Confirm Settle"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Final gate: the employee confirms before anything is written.
          Portalled on its own (z-[90]) so it always floats above this
          dialog instead of competing with it at the same z-index. */}
      <ConfirmActionDialog
        open={confirmOpen}
        icon={<BadgeCheck size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Settle the checked abono?"
        description="Do you want to confirm your abono request? Each checked record is marked as settled and stamped with today's date."
        summary={confirmSummary}
        cancelLabel="Go back"
        confirmLabel="Yes, settle"
        confirmVariant="accent"
        pendingLabel="Settling…"
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSettle}
      />
    </>,
    document.body,
  );
};

export default SettleAbonoModal;
