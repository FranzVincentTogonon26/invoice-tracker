import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CircleUser,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  useBudgetTransfer,
  useBudgetTransferMutations,
} from "../../../hooks/useBudgetTransfer";
import { SelectEmployee, EmployeeAvatar } from "../../ui/SelectEmployee";
import { Select } from "../../ui/Select";
import { Button } from "../../ui/Button";
import { Input, TextArea } from "../../ui/Input";
import { Card } from "../../ui/Card";
import ConfirmActionDialog from "../admin/expenses/ConfirmActionDialog";
import { PAYMENT_METHODS } from "../../../constants";
import { cn, formatMoney, methodLabel } from "../../../lib/utils";

const NOTES_MAX = 500;

const initialForm = {
  employee: "",
  amount: "",
  method: "cash",
  notes: "",
};

// Centavos rounding shared with the server so the client-side
// insufficient-balance preview agrees with the backend check.
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

function Field({ label, optional, hint, children, count, max }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="type-eyebrow text-[var(--ink-muted)]">
          {label}
          {optional && (
            <span className="ml-1.5 normal-case tracking-normal text-xs opacity-70">
              · optional
            </span>
          )}
        </span>
        {max != null && (
          <span className="text-xs tabular-nums text-[var(--ink-muted)] opacity-70">
            {count ?? 0}/{max}
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

const BudgetTransfer = () => {
  const nav = useNavigate();
  const { me, employees, overview, isLoading } = useBudgetTransfer();
  const { transfer } = useBudgetTransferMutations();
  const saving = transfer.isPending;

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalBalance = toMoney(overview?.totalBalance);
  const isOverdrawn = totalBalance < -0.004;

  const amountNum = useMemo(() => {
    const parsed = Number(form.amount);
    return form.amount.trim() === "" || !Number.isFinite(parsed)
      ? null
      : toMoney(parsed);
  }, [form.amount]);

  // Live preview: the amount typed against what remains. The submit validator
  // below re-checks the same rule, and the server re-checks it again.
  const insufficient =
    amountNum != null &&
    amountNum > 0 &&
    toMoney(totalBalance - amountNum) < -0.004;
  const projected =
    amountNum != null ? toMoney(totalBalance - amountNum) : null;

  const recipient = useMemo(
    () => employees.find((e) => e.user_id === form.employee) ?? null,
    [employees, form.employee],
  );

  // Listbox-based dropdowns (SelectEmployee, Select) call onChange with the
  // raw value; native inputs call it with the event — unwrap both.
  const set = (key) => (valueOrEvent) => {
    const value =
      valueOrEvent != null &&
      typeof valueOrEvent === "object" &&
      "target" in valueOrEvent
        ? valueOrEvent.target.value
        : valueOrEvent;
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user fixes it.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const next = {};

    if (!form.employee) {
      next.employee = "Select the employee who will receive this transfer.";
    } else if (me && form.employee === me.user_id) {
      next.employee = "You can't transfer to your own account.";
    }

    if (form.amount.trim() === "") {
      next.amount = "Amount is required.";
    } else if (amountNum == null) {
      next.amount = "Enter a valid amount.";
    } else if (amountNum <= 0) {
      next.amount = "Amount must be greater than zero.";
    } else if (insufficient) {
      next.amount = `Insufficient balance — ${formatMoney(amountNum)} is more than the remaining ${formatMoney(totalBalance)}.`;
    }

    if (!PAYMENT_METHODS.some((m) => m.value === form.method)) {
      next.method = "Select a payment method.";
    }

    if (form.notes.trim().length > NOTES_MAX) {
      next.notes = `Notes are too long (max ${NOTES_MAX} characters).`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirmClick = () => {
    if (saving || !validate()) return;
    setConfirmOpen(true);
  };

  const handleSubmitTransfer = async () => {
    if (saving || !validate()) {
      setConfirmOpen(false);
      return;
    }
    try {
      await transfer.mutateAsync({
        transfer_to: form.employee,
        amount: amountNum,
        method: form.method,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Budget transferred successfully");
      setConfirmOpen(false);
      setForm(initialForm);
      setErrors({});
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err?.message || "Couldn't transfer budget");
    }
  };

  const confirmSummary = recipient && amountNum != null && (
    <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-[var(--ink-muted)]">To</p>
        <p className="truncate text-sm font-semibold text-[var(--ink)]">
          {recipient.name || "Unnamed employee"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--ink-muted)]">Amount</p>
        <p className="font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(amountNum)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--ink-muted)]">Method</p>
        <p className="text-sm font-medium text-[var(--ink)]">
          {methodLabel(form.method)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
        <p className="text-sm text-[var(--ink-muted)]">Remaining after</p>
        <p
          className={cn(
            "font-display text-sm font-semibold tabular-nums",
            projected != null && projected < -0.004
              ? "text-[var(--danger)]"
              : "text-[var(--ink)]",
          )}
        >
          {projected != null ? formatMoney(projected) : "—"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => nav(-1)}
            aria-label="Go back"
            className="mt-1 h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] shadow-card transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display sm:text-2xl text-lg font-semibold tracking-tight text-[var(--ink)]">
                Budget Transfer
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-muted)] truncate">
              Transfer funds between budgets.
            </p>
          </div>
        </div>
      </div>

      {/* ── Available balance hero: plain oversized type, deliberately not a
          card, so the eye lands on the spendable figure first. ── */}
      <section aria-label="Available balance" className="pt-2 text-center">
        <p className="type-eyebrow text-[var(--ink-muted)]">
          Available balance
        </p>
        {isLoading ? (
          <div className="mx-auto mt-3 h-12 w-56 animate-pulse rounded-2xl bg-[var(--surface-2)] sm:h-14 sm:w-72" />
        ) : (
          <p
            aria-live="polite"
            className={cn(
              "truncate mt-2 font-display text-5xl font-bold leading-none tracking-tight tabular-nums transition-colors sm:text-6xl",
              insufficient || isOverdrawn
                ? "text-[var(--danger)]"
                : "text-[var(--ink)]",
            )}
          >
            {formatMoney(amountNum != null ? projected : totalBalance)}
          </p>
        )}
        <p className="mt-2 text-xs tabular-nums text-[var(--ink-muted)]">
          {amountNum != null && !isLoading ? (
            <>
              {formatMoney(totalBalance)} − {formatMoney(amountNum)}
              {" = "}
              <span
                className={cn(
                  "font-semibold",
                  insufficient || isOverdrawn
                    ? "text-[var(--danger)]"
                    : "text-[var(--ink)]",
                )}
              >
                {formatMoney(projected)}
              </span>
              {insufficient ? " · insufficient balance" : " remaining"}
            </>
          ) : me?.role === "admin" ? (
            "Total remaining across all open budget references"
          ) : (
            "Your remaining budget available to transfer"
          )}
        </p>
      </section>

      <div className="mx-auto w-full max-w-xl">
        <Card>
          {/* ── From: owner account (full width) ── */}
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
            <EmployeeAvatar
              name={me?.name}
              avatarUrl={me?.avatar_url}
              className="h-10 w-10 text-sm ring-2"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">
                {isLoading ? "Loading…" : me?.name || "Your account"}
              </div>
              <div className="truncate text-xs text-[var(--ink-muted)]">
                Account Holder
              </div>
            </div>
          </div>

          {/* ── Direction cue pointing at the recipient picker ── */}
          <div className="flex justify-center -my-2.5 relative z-10">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card"
            >
              <ArrowDown size={16} />
            </span>
          </div>

          {/* ── To: recipient picker — same card as the owner row above (no
              separate label; the card itself is the field). ── */}
          <SelectEmployee
            employees={employees}
            value={form?.employee}
            onChange={set("employee")}
            placeholder={isLoading ? "Loading employees…" : "Select employee"}
            disabled={saving || isLoading}
            searchable={false}
            buttonClassName="h-auto rounded-2xl px-3.5 py-3 bg-[var(--surface-2)] shadow-none"
            renderTrigger={(selectedOption) =>
              selectedOption ? (
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <EmployeeAvatar
                    name={selectedOption.label}
                    avatarUrl={selectedOption.employee?.avatar_url}
                    className="h-10 w-10 text-sm ring-2"
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                      {selectedOption.label}
                    </span>
                    <span className="block truncate text-xs capitalize text-[var(--ink-muted)]">
                      {selectedOption.employee?.role || "Recipient"}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-semibold text-[var(--ink-muted)] ring-2 ring-[var(--surface)]"
                  >
                    <CircleUser size={28} strokeWidth={1} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-[var(--ink-muted)]">
                      {isLoading ? "Loading employees…" : "Select employee"}
                    </span>
                    <span className="block truncate text-xs text-[var(--ink-muted)]">
                      Recipient
                    </span>
                  </span>
                </span>
              )
            }
          />
          {errors.employee && (
            <p
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--danger)]"
            >
              {errors.employee}
            </p>
          )}
          {!isLoading && employees.length === 0 && !errors.employee && (
            <p className="mt-1.5 text-xs leading-snug text-[var(--ink-muted)]">
              No active employees available to transfer to right now.
            </p>
          )}

          <div className="mt-4 space-y-4">
            <Field
              label="Amount"
              hint={`Up to ${formatMoney(totalBalance)} remaining.`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={set("amount")}
                Icon={Banknote}
                disabled={saving}
                aria-invalid={Boolean(errors.amount)}
              />
            </Field>
            {errors.amount ? (
              <p
                role="alert"
                className="-mt-2 text-xs font-medium text-[var(--danger)]"
              >
                {errors.amount}
              </p>
            ) : (
              insufficient && (
                <div
                  role="alert"
                  className="-mt-2 flex items-start gap-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--danger)]"
                >
                  <TriangleAlert
                    size={14}
                    aria-hidden
                    className="mt-px shrink-0"
                  />
                  <span>
                    Insufficient balance —{" "}
                    <span className="font-semibold tabular-nums">
                      {formatMoney(amountNum)}
                    </span>{" "}
                    is more than the remaining{" "}
                    <span className="font-semibold tabular-nums">
                      {formatMoney(totalBalance)}
                    </span>
                    . Enter an amount up to{" "}
                    <span className="font-semibold tabular-nums">
                      {formatMoney(totalBalance)}
                    </span>
                    .
                  </span>
                </div>
              )
            )}

            <Field
              label="Payment method"
              hint="How the transferred budget will be released."
            >
              <Select
                value={form?.method}
                onChange={set("method")}
                placeholder="Select payment method"
                disabled={saving}
              />
            </Field>
            {errors.method && (
              <p
                role="alert"
                className="-mt-2 text-xs font-medium text-[var(--danger)]"
              >
                {errors.method}
              </p>
            )}

            <Field
              label="Notes"
              optional
              hint="Add a note for this transaction."
              count={form.notes.length}
              max={NOTES_MAX}
            >
              <TextArea
                value={form.notes}
                onChange={set("notes")}
                placeholder="Add notes to this transaction…"
                maxLength={NOTES_MAX}
                rows={3}
                disabled={saving}
                aria-invalid={Boolean(errors.notes)}
              />
            </Field>
            {errors.notes && (
              <p
                role="alert"
                className="-mt-2 text-xs font-medium text-[var(--danger)]"
              >
                {errors.notes}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => nav(-1)}
              disabled={saving}
              className="w-full"
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={handleConfirmClick}
              disabled={saving || insufficient}
              className="w-full"
              title={
                insufficient
                  ? "Cannot proceed your request due to insufficient balance"
                  : undefined
              }
            >
              {saving && (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              )}
              {saving ? "Transferring…" : "Confirm Transfer"}
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Final gate: validated summary before anything is written. ── */}
      <ConfirmActionDialog
        open={confirmOpen}
        icon={<ArrowLeftRight size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Confirm budget transfer?"
        description={`Transfer ${amountNum != null ? formatMoney(amountNum) : ""} to ${recipient?.name || "the selected employee"}? This deducts the amount from your remaining balance.`}
        summary={confirmSummary}
        cancelLabel="Go back"
        confirmLabel="Yes, transfer"
        confirmVariant="accent"
        pendingLabel="Transferring…"
        pending={saving}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={handleSubmitTransfer}
      />
    </div>
  );
};

export default BudgetTransfer;
