import { Badge } from "../../../ui/Badge";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { SOURCE_STATUS } from "@/constants";

export function StatusBadge({ status }) {
  const meta = SOURCE_STATUS[status] ?? {
    tone: "neutral",
    label: status ?? "—",
  };
  return (
    <Badge tone={meta.tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {meta.label}
    </Badge>
  );
}

// Everyone connected to a source — issuance receivers, expense/abono authors
// and transfer parties (employees AND admins) — as an overlapping avatar
// stack with a "+N" overflow and a names tooltip.
export function InvolvedStack({ people, total }) {
  const list = Array.isArray(people) ? people : [];
  const shown = list.slice(0, 4);
  const extra = Math.max(0, (Number(total) || 0) - shown.length);
  if (shown.length === 0)
    return <span className="text-xs text-[var(--ink-muted)]">—</span>;
  const names = list
    .map((p) => `${p.name || "Unknown"}${p.role ? ` (${p.role})` : ""}`)
    .join(", ");
  return (
    <span className="inline-flex items-center" title={names}>
      <span className="flex -space-x-2">
        {shown.map((p) => (
          <EmployeeAvatar
            key={p.user_id || p.name}
            name={p.name}
            avatarUrl={p.avatar_url}
            className="h-6 w-6 text-[11px] ring-2 ring-[var(--surface)]"
          />
        ))}
      </span>
      {extra > 0 && (
        <span className="ml-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--ink-muted)] ring-1 ring-inset ring-[var(--border)]">
          +{extra}
        </span>
      )}
    </span>
  );
}
