import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  HandCoins,
  PhilippinePesoIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "../../ui/Badge";
import SelectReference from "../../ui/SelectReference";
import { cn, formatDate, formatMoney } from "../../../lib/utils";
import {
  FUNDING_STATUS,
  fundingAlternatives,
  fundingState,
} from "../../../lib/funding";

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

function Field({ label, hint, children }) {
  return (
    <div className="block min-w-0">
      <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

function BalancePrompt({ title, description }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]">
        <WalletIcon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink-muted)]">{title}</p>
        <p className="text-xs leading-snug text-[var(--ink-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

const SelectSourceFund = ({
  references = [],
  value = "",
  onChange,
  total = 0,
  disabled = false,
  loading = false,
}) => {
  const {
    sources,
    source: selected,
    expenses,
    balance,
    remaining,
    used,
    status,
  } = useMemo(
    () => fundingState(references, value, total),
    [references, value, total],
  );

  const canChoose = sources.length > 1;
  const insufficient = status === FUNDING_STATUS.insufficient;
  const depleted = status === FUNDING_STATUS.depleted;
  const funding =
    FUNDING[insufficient ? "insufficient" : depleted ? "depleted" : "funded"];

  const alternatives = useMemo(
    () =>
      insufficient
        ? fundingAlternatives(sources, selected?.reference_id, expenses)
        : [],
    [insufficient, sources, selected, expenses],
  );

  const usedLabel = !selected
    ? "No budget source selected"
    : insufficient
      ? `Expenses exceed the balance by ${formatMoney(Math.abs(remaining))}`
      : depleted
        ? "Balance fully used by these expenses"
        : `${Math.round(used)}% of the balance used`;

  return (
    <div className="space-y-3">
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

      {!loading && sources.length === 0 && (
        <BalancePrompt
          title="No open budget source"
          description="Create a budget reference first — these lines are funded against it."
        />
      )}

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

            <div className="min-w-0 flex-1">
              <p className="type-eyebrow text-[var(--ink-muted)]">Balance</p>
              <p
                className={cn(
                  "font-display flex items-center gap-1 text-lg font-semibold tracking-tight tabular-nums",
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

            <Badge tone={funding.badgeTone} className="shrink-0 text-xs">
              {funding.label}
            </Badge>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <HandCoins size={13} aria-hidden className="shrink-0" />
              <span className="truncate">
                {selected.label || "Untitled source"}
              </span>
              {!canChoose && (
                <span
                  className="shrink-0 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-xs font-semibold text-[var(--ink-muted)]"
                  title="Selected automatically — it is the only open budget source"
                >
                  auto
                </span>
              )}
            </span>

            <span className="shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
              {formatDate(selected.created_at)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="type-eyebrow text-xs text-[var(--ink-muted)]">
                expenses
              </p>
              <p className="truncate text-sm font-semibold tabular-nums text-[var(--ink)]">
                {formatMoney(expenses)}
              </p>
            </div>

            <div className="min-w-0 text-right">
              <p className="type-eyebrow text-xs text-[var(--ink-muted)]">
                {insufficient ? "Short by" : "Remaining"}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-semibold tabular-nums",
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

          <p className="mt-2 text-xs leading-snug text-[var(--ink-muted)]">
            Allocated {formatMoney(selected.allocated)} · Issued{" "}
            {formatMoney(selected.issued)}
          </p>

          {insufficient && (
            <div className="mt-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-3">
              <p className="flex items-start gap-1.5 text-xs font-semibold leading-snug text-[var(--danger)]">
                <AlertCircle size={13} aria-hidden className="mt-px shrink-0" />
                <span>
                  Cannot proceed with your request — insufficient funds. These
                  expenses are{" "}
                  <span className="tabular-nums">{formatMoney(expenses)}</span>{" "}
                  but this source is{" "}
                  <span className="tabular-nums">
                    {formatMoney(Math.abs(remaining))}
                  </span>{" "}
                  short.
                </span>
              </p>

              {alternatives.length > 0 ? (
                <div className="mt-2.5 border-t border-[var(--danger)]/20 pt-2.5">
                  <p className="type-eyebrow text-[var(--danger)]">
                    Sources that still cover this
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {alternatives.map((source) => (
                      <button
                        key={source.reference_id}
                        type="button"
                        onClick={() => onChange?.(source.reference_id)}
                        disabled={disabled}
                        title={`Fund these expenses from ${
                          source.label || "this source"
                        }`}
                        className="flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <WalletIcon
                          size={12}
                          aria-hidden
                          className="shrink-0 text-[var(--accent-strong)]"
                        />
                        <span className="truncate">
                          {source.label || "Untitled source"}
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
                          {formatMoney(source.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="mt-2 list-disc space-y-1 border-t border-[var(--danger)]/20 pt-2.5 pl-4 text-xs leading-snug text-[var(--danger)]">
                  <li>Lower an amount on any line so the total fits.</li>
                  <li>
                    {canChoose
                      ? "Top up this budget reference, or pick another source above."
                      : "Top up this budget reference so it can cover the draft."}
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SelectSourceFund;
