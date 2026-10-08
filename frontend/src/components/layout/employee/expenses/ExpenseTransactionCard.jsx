import { cn, formatMoney, methodLabel } from "@/lib/utils";
import {
  formatShortExpenseDate,
  hasExpenseReceipt,
  isExpenseActionable,
  isExpenseFlagged,
} from "@/lib/expenseLedger";
import { Badge } from "../../../ui/Badge";
import { ExpenseReceiptBadge } from "./ExpenseBadges";

export function ExpenseTransactionCard({ tx, meta, disabled, onOpen }) {
  const actionable = isExpenseActionable(tx);
  const Icon = meta.Icon;
  const flagged = isExpenseFlagged(tx);
  const hasReceipt = hasExpenseReceipt(tx);

  return (
    <div
      onClick={() => {
        if (!actionable || disabled) return;
        onOpen?.();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (!actionable || disabled || e.target.closest("button")) return;
        e.preventDefault();
        onOpen?.();
      }}
      role="button"
      tabIndex={actionable && !disabled ? 0 : undefined}
      aria-label={`Open details for ${tx.description || meta.label}`}
      className={cn(
        "relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 py-3 transition-shadow hover:shadow-card",
        actionable && !disabled && "cursor-pointer active:scale-[0.99]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            flagged
              ? "bg-[var(--warning)]/15 text-[var(--warning)]"
              : meta.iconWrapperClass,
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium leading-none text-[var(--ink)]">
            <span className="min-w-0 truncate capitalize">
              {tx.description || meta.label}
            </span>
            {flagged && (
              <Badge
                tone="warning"
                className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                title="Flagged — dated before the first budget issued to you"
              >
                Flagged
              </Badge>
            )}
          </p>
          <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
            <span className="shrink-0 tabular-nums">
              {formatShortExpenseDate(tx.date)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="truncate text-[10px] type-eyebrow">
              {methodLabel(tx.method)}
            </span>
            {hasReceipt ? (
              <ExpenseReceiptBadge className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]" />
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <p className="text-right font-display text-sm font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(tx.amount)}
        </p>
      </div>
    </div>
  );
}

export default ExpenseTransactionCard;
