import { Children, Fragment } from "react";
import { HandCoins, ReceiptText, Wallet } from "lucide-react";
import { Card } from "../../../ui/Card";
import { cn, formatMoney } from "@/lib/utils";

// Compact centered budget tile — label over a single centered value row;
// optional breakdown figures ride in the same row, split by vertical rules.
export function BudgetMetric({ icon: Icon, label, value, tone, children }) {
  // toArray drops the `false` from `{cond && <row />}` pairs, so the rule
  // only renders when at least one breakdown row actually exists.
  const breakdown = Children.toArray(children).filter(Boolean);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-2.5">
      <div className="flex items-center justify-center gap-2">
        <Icon size={14} aria-hidden className="text-[var(--ink-muted)]" />
        <p className="type-eyebrow text-[var(--ink-muted)]">{label}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <p
          className={cn(
            "font-display text-[15px] font-medium tabular-nums",
            tone === "danger"
              ? "text-[var(--danger)]"
              : tone === "accent"
                ? "text-[var(--accent-strong)]"
                : tone === "warning"
                  ? "text-[var(--warning)]"
                  : "text-[var(--ink)]",
          )}
        >
          {value}
        </p>
        {breakdown.map((row, i) => (
          <Fragment key={i}>
            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-[var(--border)]"
            />
            {row}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function EmployeeBudgetMetrics({
  issued,
  received,
  spent,
  sent,
  abono,
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <BudgetMetric
          icon={Wallet}
          label="Issued Budget"
          value={formatMoney(issued)}
        >
          {received > 0 && (
            <p
              className="text-xs font-medium tabular-nums text-[var(--accent-strong)]"
              title={`${formatMoney(received)} received from budget transfers`}
            >
              + {formatMoney(received)} received
            </p>
          )}
        </BudgetMetric>
        <BudgetMetric
          icon={ReceiptText}
          label="Total Spent"
          value={formatMoney(spent)}
        >
          {sent > 0 && (
            <p
              className="text-xs font-medium tabular-nums text-[var(--danger)]"
              title={`${formatMoney(sent)} sent via budget transfers`}
            >
              - {formatMoney(sent)} sent
            </p>
          )}
        </BudgetMetric>
        <BudgetMetric
          icon={HandCoins}
          label="Abono Held"
          value={formatMoney(abono)}
          tone={abono > 0 ? "warning" : undefined}
        />
      </div>
  );
}

export default EmployeeBudgetMetrics;
