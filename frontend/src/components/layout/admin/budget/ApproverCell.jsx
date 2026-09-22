import { UserRound } from "lucide-react";
import { cn, relativeTime } from "../../../../lib/utils";

/**
 * Approver cell: initials avatar + name, with approval recency as the muted
 * secondary line. The API exposes only the approver's name (no role), so the
 * secondary line communicates *when* the approval happened instead.
 */
export function ApproverCell({ name, approvedAt, className }) {
  const hasApprover = Boolean(name && name.trim());

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)] ring-2 ring-[var(--accent)]/10">
        {hasApprover ? (
          name.trim()[0].toUpperCase()
        ) : (
          <UserRound size={14} aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-[var(--ink)]">
          {hasApprover ? name : "Unassigned"}
        </p>
        <p className="mt-0.5 truncate text-xs leading-tight text-[var(--ink-muted)]">
          {approvedAt
            ? `Approved · ${relativeTime(approvedAt)}`
            : "Awaiting approval"}
        </p>
      </div>
    </div>
  );
}
