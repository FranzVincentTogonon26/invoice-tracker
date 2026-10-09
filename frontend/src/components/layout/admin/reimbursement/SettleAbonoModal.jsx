import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleAlert,
  HandCoins,
  Loader2,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { Input, TextArea } from "../../../ui/Input";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { LoadingSkeleton } from "../../../ui/DataState";
import ConfirmActionDialog from "../expenses/ConfirmActionDialog";
import { SourceBalanceRow } from "./SourceBalanceRow";
import { SettleAbonoRow } from "./SettleAbonoRow";
import { formatMoney } from "@/lib/utils";
import {
  computeShortfall,
  distinctSourcesByReference,
  sumRowAmounts,
} from "@/lib/reimbursement";
import { useEmployeeDetailsOverview } from "../../../../hooks/useEmployeeDetails";
import {
  reimbursementOverviewKey,
  useEmployeeReimbursement,
  useSettleAbono,
} from "../../../../hooks/useEmployeeReimbursement";
import {
  useBudgetBalance,
  useBudgetMutations,
} from "../../../../hooks/useBudget";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
const TOP_UP_NOTE_MAX = 150;

// Admin → Reimbursement → personnel row → Settle abono. Settles the checked
// OPEN abono rows (status → 'settled', `date_settled` stamped) and books each
// amount back as an `issued_budget` row under the same budget reference, so
// the fund pool stays whole. The server re-checks coverage — a request the
// employee's remaining balance can't cover is refused with nothing written.
//
// Shape lives in siblings: SourceBalanceRow (per-source summary),
// SettleAbonoRow (checkbox row) and the shared ConfirmActionDialog.
// Pure settlement math lives in @/lib/reimbursement.
export function SettleAbonoModal({ open, employee, onClose }) {
  return (
    <AnimatePresence>
      {open && employee && (
        <SettleBody
          key={String(employee.userId ?? "")}
          employee={employee}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function SettleBody({ employee, onClose }) {
  const userId = employee?.userId;
  const qc = useQueryClient();
  const { rows: allAbono, isLoading: rowsLoading } = useEmployeeReimbursement();
  const { data: empOverview } = useEmployeeDetailsOverview(userId);
  const settle = useSettleAbono();
  const { create: topUp } = useBudgetMutations();

  const [manual, setManual] = useState(null); // null = all checked
  const [topUpNote, setTopUpNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settleConfirmOpen, setSettleConfirmOpen] = useState(false);

  const openRows = useMemo(
    () =>
      (allAbono ?? []).filter(
        (r) => String(r.user_id) === String(userId) && r.status === "open",
      ),
    [allAbono, userId],
  );
  const selectedIds = manual ?? openRows.map((r) => r.id);
  // Distinct budget sources behind the open rows, keyed by `reference_id`.
  const sourceRefs = useMemo(
    () => distinctSourcesByReference(openRows),
    [openRows],
  );
  const selectedRows = useMemo(
    () => openRows.filter((r) => selectedIds.includes(r.id)),
    [openRows, selectedIds],
  );
  const requested = useMemo(() => sumRowAmounts(selectedRows), [selectedRows]);
  const coverBalance = Number(empOverview?.totalBalance ?? NaN);
  const coverKnown = Number.isFinite(coverBalance);
  const insufficient =
    coverKnown && selectedRows.length > 0 && requested > coverBalance;
  // Shortfall the employee's balance can't cover — the top-up amount
  // defaults to exactly this. Booked under the first checked row's source.
  const shortfall = insufficient
    ? computeShortfall(requested, coverBalance)
    : 0;
  const topUpRef = selectedRows[0] ?? null;
  // Locked to the shortfall — the input below is display-only.
  const topUpAmount = shortfall;
  // The top-up is issued from the checked source, so it is only offered
  // when THAT source's remaining balance covers the shortfall. A shortfall
  // bigger than the source means the button stays disabled no matter what.
  const { data: topUpSource } = useBudgetBalance(topUpRef?.reference_id);
  const sourceRemaining = Number(topUpSource?.balance ?? NaN);
  const sourceKnown = Number.isFinite(sourceRemaining);
  const sourceCanFund =
    sourceKnown && shortfall > 0 && shortfall <= sourceRemaining;
  const topUpReady =
    insufficient &&
    coverKnown &&
    sourceCanFund &&
    !topUp.isPending &&
    !settle.isPending &&
    Boolean(topUpRef?.reference_id);

  const toggle = (id) => {
    const base = manual ?? openRows.map((r) => r.id);
    setManual(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };

  const pending = settle.isPending;
  const canConfirm =
    !pending && selectedRows.length > 0 && !insufficient && coverKnown;

  const handleClose = () => {
    if (pending || topUp.isPending) return;
    onClose?.();
  };

  // Cover-the-shortfall top-up: issues the entered amount to the employee
  // under the first checked row's source, then refreshes every balance so
  // the coverage verdict re-evaluates. The dialog stays open so the admin
  // can proceed straight to settling.
  const handleTopUpConfirm = () => {
    if (!topUpReady) return;
    topUp.mutate(
      {
        type: "issuedBudget",
        reference_id: topUpRef.reference_id,
        employeeId: userId,
        amount: topUpAmount,
        method: "cash",
        description: "Top-up to cover abono settlement",
        note: topUpNote.trim() === "" ? undefined : topUpNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            `Issued ${formatMoney(topUpAmount)} to ${employee?.name || "employee"} — balance updated.`,
          );
          setConfirmOpen(false);
          setTopUpNote("");
          qc.invalidateQueries({ queryKey: ["employeeDetails"] });
          qc.invalidateQueries({ queryKey: reimbursementOverviewKey });
        },
        onError: (err) =>
          toast.error(err?.message || "Couldn't issue top-up budget"),
      },
    );
  };

  const handleConfirm = () => {
    if (!canConfirm || pending) return;
    setSettleConfirmOpen(false);
    settle.mutate(
      {
        user_id: userId,
        ids: selectedRows.map((r) => r.id),
        // Fixed settlement booking: cash, no note. The server settles the
        // checked rows in full (no partial amounts from this dialog).
        method: "cash",
      },
      {
        onSuccess: (res) => {
          toast.success(
            `Settled ${res?.settled?.length ?? selectedRows.length} abono (${formatMoney(res?.requested ?? requested)}) — re-issued to the pool.`,
          );
          onClose?.();
        },
        onError: (err) => toast.error(err?.message || "Couldn't settle abono"),
      },
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: DIALOG_EASE }}
    >
      <div
        className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settle-abono-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: DIALOG_EASE }}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover"
      >
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-6 border-b border-[var(--border)]">
          <div className="relative flex items-center gap-3">
            <EmployeeAvatar
              name={employee?.name}
              avatarUrl={employee?.avatarUrl}
              className="h-11 w-11 shrink-0 text-sm ring-2 ring-white/60"
            />
            <div className="min-w-0 flex-1">
              <h3
                id="settle-abono-title"
                className="font-display text-lg font-medium tracking-tight text-[var(--ink)]"
              >
                Settle abono
              </h3>
              <p className="mt-0.5 truncate text-xs leading-snug text-[var(--ink-muted)]">
                {employee?.name || "Employee"} ·{" "}
                {formatMoney(employee?.openAbono ?? 0)} open
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleClose}
              disabled={pending}
              aria-label="Close"
              whileTap={{ scale: 0.88 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <X size={16} />
            </motion.button>
          </div>
        </div>

        <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {rowsLoading || !coverKnown ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
                <p className="type-eyebrow text-[var(--accent-strong)]">
                  Balance after settlement
                </p>
                <motion.p
                  key={
                    coverKnown
                      ? Math.round((coverBalance - requested) * 100)
                      : "loading"
                  }
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: DIALOG_EASE }}
                  className={`mt-1 font-display text-3xl font-medium tabular-nums tracking-tight ${
                    coverKnown && coverBalance - requested < 0
                      ? "text-[var(--danger)]"
                      : "text-[var(--ink)]"
                  }`}
                >
                  {coverKnown
                    ? formatMoney(
                        Math.round((coverBalance - requested) * 100) / 100,
                      )
                    : "…"}
                </motion.p>
                <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
                  {coverKnown
                    ? `${formatMoney(coverBalance)} minus ${formatMoney(requested)} checked`
                    : "Checking balance…"}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    coverKnown && coverBalance > 0
                      ? Math.round(
                          Math.min(100, (requested / coverBalance) * 100),
                        )
                      : 0
                  }
                  aria-label="Share of balance the settlement uses"
                  className="mx-auto mt-3 h-1.5 max-w-[280px] overflow-hidden rounded-full bg-[var(--surface-2)]"
                >
                  <motion.div
                    className={`h-full rounded-full ${
                      insufficient ? "bg-[var(--danger)]" : "bg-[var(--accent)]"
                    }`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        coverKnown && coverBalance > 0
                          ? Math.min(100, (requested / coverBalance) * 100)
                          : 0
                      }%`,
                    }}
                    transition={{ duration: 0.5, ease: DIALOG_EASE }}
                  />
                </div>
              </div>

              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  insufficient
                    ? "border-[var(--danger)]/30 bg-[var(--danger)]/10"
                    : "border-[var(--border)] bg-[var(--surface-2)]/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    To settle · Coverage
                  </p>
                  <p className="mt-0.5 truncate text-sm tabular-nums text-[var(--ink-muted)]">
                    {coverKnown
                      ? `${formatMoney(coverBalance)} available`
                      : "Checking balance…"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    To settle
                  </p>
                  <motion.p
                    key={Math.round(requested * 100)}
                    initial={{ opacity: 0.4, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: DIALOG_EASE }}
                    className={`mt-0.5 font-display text-xl font-medium tabular-nums tracking-tight ${
                      insufficient
                        ? "text-[var(--danger)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {formatMoney(requested)}
                  </motion.p>
                </div>
              </div>

              {rowsLoading ? (
                <p className="text-sm text-[var(--ink-muted)]">
                  Loading open abono…
                </p>
              ) : openRows.length === 0 ? (
                <Badge tone="warning" className="w-full text-center py-4 rounded-2xl">
                  No open abono left to settle for this employee.
                </Badge>
              ) : (
                <ul className="space-y-2">
                  {openRows.map((r, i) => (
                    <SettleAbonoRow
                      key={r.id}
                      row={r}
                      index={i}
                      checked={selectedIds.includes(r.id)}
                      disabled={pending}
                      onToggle={toggle}
                    />
                  ))}
                </ul>
              )}

              <AnimatePresence initial={false}>
                {insufficient && (
                  <motion.div
                    key="shortfall"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: DIALOG_EASE }}
                    className="overflow-hidden rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/[0.07] px-4 py-3.5"
                  >
                    <p className="type-eyebrow text-[var(--warning)]">
                      Budget sources · short{" "}
                      {coverKnown ? formatMoney(shortfall) : ""}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {sourceRefs.map((s) => (
                        <SourceBalanceRow
                          key={s.reference_id}
                          referenceId={s.reference_id}
                          label={s.label}
                          shortfall={shortfall}
                        />
                      ))}
                    </ul>
                    <p className="mt-2 text-xs tabular-nums text-[var(--ink-muted)]">
                      {coverKnown
                        ? `Balance left ${formatMoney(coverBalance)} — needs ${formatMoney(requested)}`
                        : "Checking balance…"}
                    </p>

                    <label className="mt-3 block">
                      <span className="type-eyebrow mb-1.5 block text-[var(--ink-muted)]">
                        Short amount
                      </span>
                      <Input
                        value={shortfall}
                        readOnly
                        disabled
                        title="Locked to the shortfall amount"
                        min="0"
                        type="number"
                        inputMode="decimal"
                      />
                      <span className="mt-1.5 block text-xs leading-snug text-[var(--ink-muted)]">
                        Locked to the shortfall — issued to{" "}
                        {employee?.name || "the employee"} under{" "}
                        {topUpRef?.reference_label ||
                          sourceRefs.find(
                            (s) => s.reference_id === topUpRef?.reference_id,
                          )?.label ||
                          "the checked source"}
                        .
                      </span>
                    </label>

                    <label className="mt-3 block">
                      <span className="type-eyebrow mb-1.5 block text-[var(--ink-muted)]">
                        Notes{" "}
                        <span className="normal-case opacity-70">
                          · optional
                        </span>
                      </span>
                      <TextArea
                        value={topUpNote}
                        onChange={(e) => setTopUpNote(e.target.value)}
                        placeholder="Recorded on the top-up issuance…"
                        rows={2}
                        maxLength={TOP_UP_NOTE_MAX}
                        disabled={topUp.isPending}
                      />
                    </label>

                    <Button
                      type="button"
                      variant="accent"
                      onClick={() => setConfirmOpen(true)}
                      disabled={!topUpReady}
                      title={
                        pending || topUp.isPending
                          ? "Wait for the running request to finish"
                          : !coverKnown
                            ? "Checking balance…"
                            : !sourceKnown
                              ? "Checking source balance…"
                              : !sourceCanFund
                                ? "Source balance too low — cannot fund this top-up"
                                : undefined
                      }
                      className="mt-3 w-full transition-transform active:scale-[0.98]"
                    >
                      <Plus size={14} aria-hidden />
                      Add budget · {formatMoney(topUpAmount)}
                    </Button>
                    {insufficient && sourceKnown && !sourceCanFund && (
                      <p
                        role="note"
                        className="mt-2 flex items-start gap-2 text-xs leading-snug text-[var(--danger)]"
                      >
                        <CircleAlert
                          size={14}
                          className="mt-px shrink-0"
                          aria-hidden
                        />
                        Source balance low — cannot proceed with this top-up.
                        Uncheck rows to lower the shortfall below the
                        source&apos;s remaining balance.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {insufficient && (
                  <motion.p
                    key="shortfall-alert"
                    role="alert"
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.25, ease: DIALOG_EASE }}
                    className="flex items-start gap-2 overflow-hidden text-xs leading-snug text-[var(--danger)]"
                  >
                    <CircleAlert size={14} className="mt-px shrink-0" />
                    The checked abono exceeds the employee&apos;s remaining
                    balance — uncheck some rows first.
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => canConfirm && setSettleConfirmOpen(true)}
            disabled={!canConfirm}
            title={
              insufficient
                ? "Settlement amount exceeds the remaining balance"
                : selectedRows.length === 0
                  ? "Check at least one abono row"
                  : undefined
            }
            className="transition-transform active:scale-[0.98]"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? "Settling…" : "Confirm Settle"}
          </Button>
        </div>
      </motion.div>

      <ConfirmActionDialog
        open={confirmOpen}
        icon={<HandCoins size={18} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Confirm budget top-up?"
        description={
          <>
            Issue{" "}
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(topUpAmount)}
            </span>{" "}
            to {employee?.name || "the employee"} under{" "}
            <span className="font-medium text-[var(--ink)]">
              {topUpRef?.reference_label || "the checked source"}
            </span>
            . Coverage becomes{" "}
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(coverBalance + topUpAmount)}
            </span>{" "}
            against {formatMoney(requested)} to settle.
          </>
        }
        cancelLabel="Go back"
        confirmLabel="Yes, issue it"
        confirmVariant="accent"
        pendingLabel="Issuing…"
        pending={topUp.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleTopUpConfirm}
      />

      <ConfirmActionDialog
        open={settleConfirmOpen}
        icon={<Wallet size={18} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Confirm abono settlement?"
        description={
          <>
            Settle{" "}
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {selectedRows.length}{" "}
              {selectedRows.length === 1 ? "abono" : "abonos"}
            </span>{" "}
            ({formatMoney(requested)}) for{" "}
            {employee?.name || "the employee"}? Each amount returns to the
            pool as issued budget, and the rows flip to settled — this
            can&apos;t be undone.
          </>
        }
        cancelLabel="Go back"
        confirmLabel="Yes, settle it"
        confirmVariant="accent"
        pendingLabel="Settling…"
        pending={pending}
        onCancel={() => setSettleConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </motion.div>
  );
}

export default SettleAbonoModal;
