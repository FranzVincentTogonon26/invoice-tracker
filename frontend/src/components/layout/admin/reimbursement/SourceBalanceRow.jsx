import { cn, formatMoney } from "@/lib/utils";
import { useBudgetBalance } from "../../../../hooks/useBudget";

// One budget-source summary row inside the settlement dialog — keyed by
// `reference_id`: the source label plus its Allocated / Issued / Spent legs
// and the remaining balance the settlement draws from. When `shortfall`
// exceeds the remaining balance the row raises the red Insufficient flag.
export function SourceBalanceRow({ referenceId, label, shortfall = 0 }) {
  const { data, isLoading } = useBudgetBalance(referenceId);
  const balance = Number(data?.balance ?? 0);
  // This source cannot cover the settlement shortfall on its own.
  const insufficient =
    !isLoading && Number.isFinite(shortfall) && shortfall > balance;
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            insufficient ? "bg-[var(--danger)]" : "bg-[var(--accent)]/60",
          )}
        />
        <span className="min-w-0 truncate text-xs text-[var(--ink-muted)]">
          {label}
          <span className="opacity-70">
            {" · "}
            {isLoading
              ? "Checking…"
              : `Allocated ${formatMoney(data?.allocated)} · Issued ${formatMoney(data?.issued)} · Spent ${formatMoney(data?.expenses)}`}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {insufficient && (
          <span
            role="status"
            title={`Balance low — ${formatMoney(balance)} remaining cannot cover the ${formatMoney(shortfall)} shortfall`}
            className="rounded-full bg-[var(--danger)]/12 px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]"
          >
            Insufficient
          </span>
        )}
        <span
          className={cn(
            "font-medium tabular-nums",
            balance < 0 || insufficient
              ? "text-[var(--danger)]"
              : "text-[var(--ink)]",
          )}
          title="Remaining balance"
        >
          {isLoading ? "…" : formatMoney(balance)}
        </span>
      </span>
    </li>
  );
}

export default SourceBalanceRow;
