import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  HandCoins,
  PhilippinePesoIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "../../../ui/Badge";
import SelectReference from "../../../ui/SelectReference";
import { cn, formatDate, formatMoney } from "../../../../lib/utils";

/* Money columns arrive from pg as DECIMAL strings and SUM() over zero rows as
   NULL — coerce once so every comparison below is numeric. */
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* Mirrors `Budget.referenceBalance()` on the server: a source can still spend
   `allocated − issued`. Recomputing it here keeps the card correct even when
   only the raw columns arrive. */
const withBalance = (reference) => {
  const allocated = toNumber(reference.allocated);
  const issued = toNumber(reference.issued);
  return {
    ...reference,
    allocated,
    issued,
    balance:
      reference.balance == null
        ? allocated - issued
        : toNumber(reference.balance),
  };
};

/* The three funding states the balance card can be in:
   `insufficient` = the draft costs more than the source has left,
   `depleted`     = it uses the rest up exactly (or the source holds nothing),
   `funded`       = the source still covers everything typed in. */
const FUNDING = {
  funded: {
    label: "Funded",
    badgeTone: "success",
    card: "border-[var(--border)] bg-[var(--surface-2)]/60",
    icon: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    amount: "text-[var(--ink)]",
    remaining: "text-[var(--accent-strong)]",
    bar: "bg-[var(--accent)]",
  },
  depleted: {
    label: "Depleted",
    badgeTone: "warning",
    card: "border-[var(--warning)]/30 bg-[var(--warning)]/10",
    icon: "bg-[var(--warning)]/15 text-[var(--warning)]",
    amount: "text-[var(--warning)]",
    remaining: "text-[var(--warning)]",
    bar: "bg-[var(--warning)]",
  },
  insufficient: {
    label: "Insufficient",
    badgeTone: "danger",
    card: "border-[var(--danger)]/30 bg-[var(--danger)]/10",
    icon: "bg-[var(--danger)]/12 text-[var(--danger)]",
    amount: "text-[var(--danger)]",
    remaining: "text-[var(--danger)]",
    bar: "bg-[var(--danger)]",
  },
};

/* Eyebrow + control wrapper (same shape as the AddExpenses `Field`). It is a
   `div` on purpose: the picker's trigger is a button, so clicking a wrapping
   `<label>` would fire it a second time. */
function Field({ label, hint, children }) {
  return (
    <div className="block min-w-0">
      <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[12px] leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Dashed prompt shown until a source is picked, or when none is available. */
function BalancePrompt({ title, description }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]">
        <WalletIcon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--ink-muted)]">{title}</p>
        <p className="text-xs leading-snug text-[var(--ink-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

/**
 * Picks the budget source ("budget reference") that funds the draft and shows
 * its live balance minus the expenses entered so far.
 *
 * Controlled: the parent owns `value` (a `reference_id`) and is notified
 * through `onChange`. With a single open source there is nothing to choose —
 * the parent mirrors that fallback, this card just renders it as auto-selected.
 */
const SelectSourceFund = ({
  references = [],
  value = "",
  onChange,
  total = 0,
  disabled = false,
  loading = false,
}) => {
  const sources = useMemo(() => references.map(withBalance), [references]);

  // Fall back to the only open source so a workspace with one source never has
  // to click through a picker that has nothing to pick.
  const selected =
    sources.find((source) => source.reference_id === value) ??
    (sources.length === 1 ? sources[0] : null);

  const canChoose = sources.length > 1;
  const expenses = toNumber(total);
  const balance = selected?.balance ?? 0;
  const remaining = balance - expenses;

  const insufficient = Boolean(selected) && remaining < 0;
  const depleted = Boolean(selected) && !insufficient && remaining <= 0;
  const funding =
    FUNDING[insufficient ? "insufficient" : depleted ? "depleted" : "funded"];

  // Share of the balance this draft consumes — an unfunded source reads 100%.
  const used =
    balance > 0 ? Math.min(100, Math.max(0, (expenses / balance) * 100)) : 100;

  const usedLabel = !selected
    ? "No budget source selected"
    : insufficient
      ? `Expenses exceed the balance by ${formatMoney(Math.abs(remaining))}`
      : depleted
        ? "Balance fully used by these expenses"
        : `${Math.round(used)}% of the balance used`;

  return (
    <div className="space-y-3">
      {/* Sources still loading — a skeleton, so the empty state below never
          flashes "No open budget source" while the request is in flight. */}
      {loading && sources.length === 0 && (
        <div
          role="status"
          aria-label="Loading budget sources"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3 shadow-card"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-6 w-36 animate-pulse rounded bg-[var(--border)]" />
            </div>
          </div>
        </div>
      )}

      {/* No open source at all — point at the fix instead of rendering an
          empty picker. */}
      {!loading && sources.length === 0 && (
        <BalancePrompt
          title="No open budget source"
          description="Create a budget reference first — these lines are funded against it."
        />
      )}

      {/* More than one source: let the admin choose which one funds the lines. */}
      {canChoose && (
        <Field
          label="Budget reference"
          hint="Pick the budget source these expenses are drawn from."
        >
          <SelectReference
            references={sources}
            value={selected?.reference_id ?? ""}
            onChange={onChange}
            placeholder="Select budget source"
            disabled={disabled}
          />
        </Field>
      )}

      {/* Nothing picked yet — the dashed prompt the budget forms use. */}
      {sources.length > 0 && !selected && (
        <BalancePrompt
          title="Balance"
          description="Select a budget source to view its remaining balance."
        />
      )}

      {selected && (
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-3.5 shadow-card transition-colors",
            funding.card,
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--surface)]",
                funding.icon,
              )}
            >
              <WalletIcon size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">Balance</p>
              <p
                className={cn(
                  "flex items-center gap-1 text-2xl font-semibold tracking-tight tabular",
                  funding.amount,
                )}
              >
                <PhilippinePesoIcon size={20} className="shrink-0 opacity-70" />
                {Number(balance).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <Badge tone={funding.badgeTone} className="shrink-0">
              {funding.label}
            </Badge>
          </div>

          {/* Which source the numbers belong to — a lone source is auto-picked. */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
              <HandCoins size={13} aria-hidden className="shrink-0" />
              <span className="truncate">
                {selected.label || "Untitled source"}
              </span>
              {!canChoose && (
                <span
                  className="shrink-0 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]"
                  title="Selected automatically — it is the only open budget source"
                >
                  auto
                </span>
              )}
            </span>
            <span className="shrink-0 text-[12px] tabular text-[var(--ink-muted)]">
              {formatDate(selected.created_at)}
            </span>
          </div>

          {/* Live math: what this draft costs vs. what the source has left. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                These expenses
              </p>
              <p className="truncate text-sm font-semibold tabular text-[var(--ink)]">
                {formatMoney(expenses)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                {insufficient ? "Short by" : "Remaining"}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-semibold tabular",
                  funding.remaining,
                )}
              >
                {formatMoney(insufficient ? Math.abs(remaining) : remaining)}
              </p>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(used)}
            aria-label={`Balance used by the ${formatMoney(expenses)} entered`}
            aria-valuetext={usedLabel}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${used}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={cn("h-full rounded-full", funding.bar)}
            />
          </div>

          <p className="mt-2 text-[11px] leading-snug text-[var(--ink-muted)]">
            Allocated {formatMoney(selected.allocated)} · Issued{" "}
            {formatMoney(selected.issued)}
          </p>

          {insufficient && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--danger)]">
              <AlertCircle size={12} aria-hidden className="mt-px shrink-0" />
              Over the balance by {formatMoney(Math.abs(remaining))} — pick
              another source or lower the amounts.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectSourceFund;
