import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CircleCheck,
  Inbox,
  Loader2,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardTitle } from "../../../ui/Card";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import { Button } from "../../../ui/Button";
import ExpenseDetailsModal from "../expenses/ExpenseDetailsModal";
import { ExpenseRowMenu } from "./ExpenseRowMenu";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  relativeDayLabel,
} from "@/lib/utils";
import {
  buildReviewTips,
  getReviewProgress,
  sortExpensesNewestFirst,
  toExpenseModalRow,
} from "@/lib/reimbursement";
import { STATUS } from "../../../../constants";
import { useEmployeeDetailsExpenses } from "../../../../hooks/useEmployeeDetails";
import { useExpensesMutations } from "../../../../hooks/useExpenses";
import { useSubmitReimbursement } from "../../../../hooks/useEmployeeReimbursement";

// Tip tone → icon (the lib returns tone only, keeping it UI-free).
const TIP_ICONS = {
  warning: AlertCircle,
  danger: AlertCircle,
  success: CircleCheck,
};

// ── Review checklist + summary ─────────────────────────────────────────────
//
// To-do list of every expense transaction of the employee, each with a
// checkbox that persists to `expenses.review` ('yes' = reviewed) the moment
// it is ticked — no save/discard step. The sticky summary rail counts total
// vs. checked transactions and lists data-driven reimbursement
// recommendations (unreviewed, flagged, open abono, overdrawn).
export function ReviewSection({ employeeId, row, onSettleAbono, hasOpenAbono }) {
  const nav = useNavigate();
  const { expenses, isLoading, refetch } =
    useEmployeeDetailsExpenses(employeeId);
  const { setReview, setStatus } = useExpensesMutations();
  const submit = useSubmitReimbursement();
  const [togglingId, setTogglingId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  // Latest transactions on top — sorted client-side so refetches and
  // toggles can never reshuffle the list out from under the checkboxes.
  const ordered = useMemo(() => sortExpensesNewestFirst(expenses), [expenses]);

  const { total, checked, pending, flagged, pct } = useMemo(
    () => getReviewProgress(expenses),
    [expenses],
  );

  const toggle = async (expense) => {
    const next = expense.review === "yes" ? "no" : "yes";
    setTogglingId(expense.id);
    try {
      await setReview.mutateAsync({ id: expense.id, review: next });
      // Checking also marks the row paid — a reviewed line counts toward
      // the balances. Skipped when already paid to avoid a redundant write.
      if (next === "yes" && expense.status !== "paid") {
        await setStatus.mutateAsync({ id: expense.id, status: "paid" });
      }
      // Hold the spinner until the refetched rows land — otherwise it
      // clears while the list still shows the old tick.
      await refetch();
    } catch (err) {
      toast.error(err?.message || "Couldn't update review");
    } finally {
      setTogglingId(null);
    }
  };

  // Cancel / restore one row — the loader waits for the refetch so the
  // badge and styling flip exactly when the fresh row paints. Cancelling
  // always marks the row reviewed (`review` → 'yes'): voiding a line means
  // an admin has looked at it, so the checkbox keeps its reviewed state in
  // danger tone unconditionally.
  const changeStatus = async (expense, status, verb) => {
    setActingId(expense.id);
    try {
      await setStatus.mutateAsync({ id: expense.id, status });
      if (status === "cancel") {
        await setReview.mutateAsync({ id: expense.id, review: "yes" });
      } else {
        // Restore (paid, incl. from draft): the line re-enters the pool
        // unreviewed and needs a fresh tick.
        await setReview.mutateAsync({ id: expense.id, review: "no" });
      }
      await refetch();
      toast.success(
        verb === "cancel" ? "Expense cancelled" : "Expense restored",
      );
    } catch (err) {
      toast.error(err?.message || "Couldn't update expense");
    } finally {
      setActingId(null);
    }
  };

  // Check all / uncheck all — flips every row that isn't already in the
  // target state, then the shared invalidation refetches once per write
  // (last one wins, all cheap).
  const checkAll = async (review) => {
    // Cancelled rows are pinned at reviewed — never bulk-flip them.
    const targets = expenses.filter(
      (e) =>
        e.status !== "cancel" &&
        (review === "yes" ? e.review !== "yes" : e.review !== "no"),
    );
    if (targets.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        targets.map(async (e) => {
          await setReview.mutateAsync({ id: e.id, review });
          // Same rule as a single tick: checking also marks the row paid.
          if (review === "yes" && e.status !== "paid") {
            await setStatus.mutateAsync({ id: e.id, status: "paid" });
          }
        }),
      );
      // Keep the veil up until the refreshed list arrives, so it lifts
      // exactly when the new ticks paint.
      await refetch();
    } catch (err) {
      toast.error(err?.message || "Couldn't update all reviews");
    } finally {
      setBulkBusy(false);
    }
  };

  const tips = useMemo(
    () =>
      buildReviewTips({
        pending,
        total,
        flagged,
        openAbono: row?.openAbono,
        balance: row?.balance,
      }),
    [pending, total, flagged, row],
  );

  if (isLoading) return <LoadingSkeleton rows={4} />;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="px-2 sm:px-6">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">
                Expenses review checklist
              </CardTitle>
              <CardDescription className="text-xs">
                Tick a transaction once its receipt and amount check out — ticks
                save instantly.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone="neutral" className="tabular-nums">
                {checked} of {total} reviewed
              </Badge>
              {total > 0 &&
                (pending > 0 ? (
                  <button
                    type="button"
                    onClick={() => checkAll("yes")}
                    disabled={bulkBusy}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent-strong)] transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {bulkBusy ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={13} strokeWidth={3} aria-hidden />
                    )}
                    Check all
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => checkAll("no")}
                    disabled={bulkBusy}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-50"
                  >
                    {bulkBusy ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <X size={13} aria-hidden />
                    )}
                    Uncheck all
                  </button>
                ))}
            </div>
          </div>

          {total === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No expense transactions yet"
              description="Nothing to review for this employee right now."
            />
          ) : (
            <div className="relative pt-4">
              <ul
                aria-busy={bulkBusy || undefined}
                className={cn(
                  "space-y-2.5",
                  bulkBusy && "pointer-events-none select-none",
                )}
              >
                {ordered.map((e) => {
                  const isChecked = e.review === "yes";
                  const busy = togglingId === e.id;
                  const acting = actingId === e.id;
                  const isCancelled = e.status === "cancel";
                  const meta = STATUS[e.status] ?? {
                    tone: "neutral",
                    label: e.status ?? "—",
                  };
                  return (
                    <li
                      key={e.id}
                      aria-busy={acting || undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors sm:gap-4",
                        // While this row's cancel/restore is in flight the
                        // whole row goes inert (not just the kebab) so a
                        // second click can't slip through mid-write.
                        acting && "pointer-events-none select-none opacity-80",
                        isCancelled
                          ? "border-[var(--danger)]/25 bg-[var(--danger)]/[0.04]"
                          : isChecked
                            ? "border-[var(--success)]/25 bg-[var(--success)]/[0.06]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30",
                      )}
                    >
                      <label
                        title={
                          isCancelled
                            ? "Cancelled rows can't be reviewed"
                            : `Mark "${e.description || "expense"}" as reviewed`
                        }
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3",
                          isCancelled || busy || bulkBusy
                            ? "cursor-not-allowed"
                            : "cursor-pointer",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isChecked}
                          disabled={busy || bulkBusy || isCancelled}
                          onChange={() => toggle(e)}
                          aria-label={`Mark "${e.description || "expense"}" as reviewed`}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            isCancelled
                              ? "border-transparent bg-[var(--danger)] text-white"
                              : isChecked
                                ? "border-transparent bg-[var(--success)] text-white"
                                : "border-[var(--border)] text-transparent",
                            !(busy || bulkBusy || isCancelled) &&
                              !isChecked &&
                              "hover:border-[var(--success)]/60",
                            (busy || bulkBusy || isCancelled) && "opacity-60",
                          )}
                        >
                          {busy ? (
                            <Loader2
                              size={13}
                              className="animate-spin text-[var(--ink-muted)]"
                            />
                          ) : isCancelled ? (
                            <X size={14} strokeWidth={3} aria-hidden />
                          ) : (
                            <Check size={14} strokeWidth={3} aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              isCancelled
                                ? "text-[var(--danger)] line-through"
                                : isChecked
                                  ? "text-[var(--ink-muted)]"
                                  : "text-[var(--ink)]",
                            )}
                          >
                            {e.description || "Untitled expense"}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                            {e.category_name || "Uncategorized"} ·{" "}
                            {formatDate(e.expense_date)}
                          </p>
                        </div>
                      </label>
                      <div className="hidden w-[76px] shrink-0 items-center justify-center min-[400px]:flex">
                        {(e.receipt_id || e.image_url) && (
                          <Badge
                            tone="accent"
                            title="Receipt attached — open the actions menu and choose View"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px]"
                          >
                            Receipt
                          </Badge>
                        )}
                      </div>
                      <div className="hidden w-[92px] shrink-0 flex-col items-end leading-tight min-[400px]:flex">
                        <span className="whitespace-nowrap text-xs font-medium text-[var(--ink)]">
                          {relativeDayLabel(e.expense_date)}
                        </span>
                        <span className="whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
                          {formatTime(e.expense_date)}
                        </span>
                      </div>
                      <div className="flex min-w-[104px] shrink-0 flex-col items-end gap-1">
                        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]">
                          {formatMoney(e.total_amount)}
                        </span>
                        <span className="flex items-center gap-1">
                          {Number(e.flag) === 1 && (
                            <Badge
                              tone="danger"
                              className="px-1.5 py-0.5 text-[11px]"
                            >
                              Flagged
                            </Badge>
                          )}
                          <Badge
                            tone={meta.tone}
                            className="px-1.5 py-0.5 text-[11px]"
                          >
                            {meta.label}
                          </Badge>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center border-l border-[var(--border)] pl-2.5">
                        <ExpenseRowMenu
                          status={e.status}
                          busy={acting}
                          onView={() => setViewRow(toExpenseModalRow(e))}
                          onCancel={() => changeStatus(e, "cancel", "cancel")}
                          onRestore={() => changeStatus(e, "paid", "restore")}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {bulkBusy && (
                <div
                  role="status"
                  aria-label="Checking all transactions"
                  className="absolute inset-0 top-4 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface)]/70 backdrop-blur-[2px]"
                >
                  <Loader2
                    size={22}
                    className="animate-spin text-[var(--accent-strong)]"
                    aria-hidden
                  />
                  <p className="text-xs font-medium text-[var(--ink-muted)]">
                    Checking all…
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="lg:sticky lg:top-4">
          <Card className="px-2 sm:px-6">
            <CardTitle className="text-lg">Summary</CardTitle>
            <CardDescription>
              Review progress for {row?.name || "this employee"}.
            </CardDescription>

            <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
              <p className="type-eyebrow text-[var(--accent-strong)]">
                Reviewed transactions
              </p>
              <p className="mt-1 font-display text-3xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
                {checked}
                <span className="text-lg text-[var(--ink-muted)]">
                  {" "}
                  of {total}
                </span>
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Review progress"
                className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--accent-strong)] transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ink-muted)]">
                  Total transactions
                </span>
                <span className="font-medium tabular-nums text-[var(--ink)]">
                  {total}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ink-muted)]">Checked</span>
                <span className="font-medium tabular-nums text-[var(--success)]">
                  {checked}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--ink-muted)]">Still to check</span>
                <span className="font-medium tabular-nums text-[var(--warning)]">
                  {pending}
                </span>
              </li>
            </ul>

            <div className="my-4 border-t border-[var(--border)] pt-4">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                Recommendations
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                What to clear before reimbursing.
              </p>
              <ul className="mt-3 space-y-2">
                {tips.map(({ key, tone, text }) => {
                  const Icon = TIP_ICONS[tone] ?? AlertCircle;
                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-snug",
                        tone === "danger" &&
                          "border-[var(--danger)]/20 bg-[var(--danger)]/10 text-[var(--danger)]",
                        tone === "warning" &&
                          "border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)]",
                        tone === "success" &&
                          "border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]",
                      )}
                    >
                      <Icon size={15} className="mt-px shrink-0" aria-hidden />
                      <span className="text-[var(--ink)]">{text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              {hasOpenAbono ? (
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => onSettleAbono?.()}
                  title={`Settle ${row?.name || "employee"}'s open abono`}
                  className="w-full"
                >
                  <Wallet size={15} aria-hidden />
                  Settle abono
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => setSubmitConfirmOpen(true)}
                  disabled={total === 0 || pending > 0}
                  title={
                    total === 0
                      ? "No transactions to submit"
                      : pending > 0
                        ? `${pending} of ${total} still unreviewed`
                        : "All transactions reviewed — ready to submit"
                  }
                  className="w-full transition-transform active:scale-[0.98]"
                >
                  Confirm review reimbursement
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => nav("/admin/reimbursement")}
                className="w-full"
              >
                Discard and go back
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <ExpenseDetailsModal
        open={Boolean(viewRow)}
        expense={viewRow}
        referenceLabel={viewRow?.sourceOfFunds ?? ""}
        onClose={() => setViewRow(null)}
        onFlagCleared={() => refetch()}
      />
      <AnimatePresence>
        {submitConfirmOpen && (
          <motion.div
            key="submit-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/40 p-6 backdrop-blur-sm"
          >
            <motion.div
              key="submit-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="submit-confirm-title"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-white shadow-card">
                  <Check size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h4
                    id="submit-confirm-title"
                    className="font-display text-lg font-medium tracking-tight text-[var(--ink)]"
                  >
                    Submit this reimbursement?
                  </h4>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {row?.name || "This employee"} · all {total} reviewed
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-[var(--ink)]">
                    {checked} of {total} transactions
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    Review complete — ready for processing
                  </p>
                </div>
                <span className="shrink-0 font-display text-2xl font-medium tabular-nums text-[var(--accent-strong)]">
                  {pct}%
                </span>
              </div>
              <p className="mt-3 text-xs leading-snug text-[var(--ink-muted)]">
                Submitting closes this reimbursement for processing.
                Transactions stay viewable afterward, but no further edits are
                allowed.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubmitConfirmOpen(false)}
                >
                  Go back
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => {
                    submit.mutate(employeeId, {
                      onSuccess: (res) => {
                        setSubmitConfirmOpen(false);
                        toast.success(
                          res?.message ??
                            `Reimbursement submitted for ${row?.name || "this employee"}.`,
                        );
                      },
                      onError: (err) =>
                        toast.error(
                          err?.message || "Couldn't submit reimbursement",
                        ),
                    });
                  }}
                  disabled={submit.isPending}
                  className="transition-transform active:scale-[0.98]"
                >
                  {submit.isPending ? "Submitting…" : "Yes, submit it"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ReviewSection;
