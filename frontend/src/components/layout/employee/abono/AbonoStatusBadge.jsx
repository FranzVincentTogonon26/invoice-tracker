import { Badge } from "../../../ui/Badge";

// employee_abono.status values — mirrors how ExpenseStatusBadge maps the
// expenses CHECK constraint, so every ledger badge speaks the same language.
//   - open:   live money the employee is still owed → amber (actionable)
//   - settled: reimbursed/closed out → green
//   - draft:  parked record → quiet neutral
const ABONO_STATUS = {
  open: { tone: "warning", label: "Open" },
  settled: { tone: "success", label: "Settled" },
  draft: { tone: "neutral", label: "Draft" },
};

export function AbonoStatusBadge({ status, className }) {
  const s = ABONO_STATUS[status] ?? {
    tone: "neutral",
    label: status ?? "-",
  };
  return (
    <Badge tone={s.tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </Badge>
  );
}