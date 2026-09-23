import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { STATUS } from "../../constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight tabular-nums",
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border)]",
        accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        success: "bg-[var(--success)]/12 text-[var(--success)]",
        warning: "bg-[var(--warning)]/14 text-[var(--warning)]",
        danger: "bg-[var(--danger)]/12 text-[var(--danger)]",
        ink: "bg-[var(--ink)] text-[var(--bg)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function StatusBadge({ status, className }) {
  // Fallback must resolve to a real entry: `STATUS.draft` was never a key
  // (draft lives in EXPENSE_STATUS), so an unknown status made `s` undefined
  // and threw on `s.tone`, taking the whole table down. Mirrors the sibling
  // ExpenseStatusBadge: a neutral pill that still prints the raw status.
  const s = STATUS[status] ?? { tone: "neutral", label: status ?? "-" };
  return (
    <Badge tone={s.tone} className={className}>
      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      {s.label}
    </Badge>
  );
}

