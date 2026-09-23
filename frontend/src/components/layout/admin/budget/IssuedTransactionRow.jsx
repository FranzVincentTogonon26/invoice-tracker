import { HandCoins } from "lucide-react";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { PaymentMethod, methodLabel } from "./PaymentMethod";
import { IssuedTransactionActions } from "./IssuedTransactionActions";

/* ── Cell building blocks ────────────────────────────────────────────────── */

// Avatar with an initials fallback (users.avatar_url is usually NULL).
function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function EmployeeCell({ name, role, avatarUrl, size = "md" }) {
  // "sm" fits narrow ledger columns (Expenses table); "md" is the original
  // Budget Issued Transaction sizing.
  const compact = size === "sm";
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className={cn(
            "shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]",
            compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
          )}
        >
          {initialsOf(name) || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold leading-tight text-[var(--ink)]",
            compact ? "text-sm" : "text-base",
          )}
        >
          {name || "Unknown"}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate capitalize text-[var(--ink-muted)]",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {/* users.role is CHECK-constrained to 'admin' | 'employee' */}
          {role || "—"}
        </p>
      </div>
    </div>
  );
}

function NotesCell({ notes }) {
  if (!notes)
    return <span className="text-[13px] text-[var(--ink-muted)]">—</span>;
  return (
    <p
      title={notes}
      className="line-clamp-2 whitespace-normal break-words text-[13px] leading-relaxed text-[var(--ink-muted)]"
    >
      {notes}
    </p>
  );
}

function DateIssuedCell({ date }) {
  return (
    <>
      <p className="text-sm leading-none tabular-nums text-[var(--ink)]">
        {formatDate(date)}
      </p>
      <p className="mt-1 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
        {formatTime(date)}
      </p>
    </>
  );
}

/* ── Row + card ──────────────────────────────────────────────────────────── */

/**
 * Desktop table row. `<td>` cells follow the fixed column proportions set in
 * `IssuedTransactionTable` — Employee · Description · Source · Amount (right) ·
 * Payment Method · Notes · Date Issued · Status (center) · Actions.
 */
export function IssuedTransactionRow({ transaction: t, onAction }) {
  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]">
      <td className="relative px-4 py-3.5 pl-5 align-middle">
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--accent-strong)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
        <EmployeeCell
          name={t.employee}
          role={t.employee_role}
          avatarUrl={t.avatar_url}
        />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <p className="text-sm leading-snug text-[var(--ink)]">
          {t.description}
        </p>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <span className="text-sm leading-snug text-[var(--ink)]">
          {t.source_of_funds}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right align-middle">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <Badge tone="neutral" className="max-w-full">
          <PaymentMethod method={t.method} />
        </Badge>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <NotesCell notes={t.notes} />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <DateIssuedCell date={t.date_issued} />
      </td>
      <td className="px-4 py-3.5 text-center align-middle">
        <StatusBadge status={t.status} />
      </td>
      <td className="px-4 py-3.5 pr-5 align-middle">
        <div className="flex justify-end">
          <IssuedTransactionActions
            transaction={t}
            onAction={onAction}
            variant="menu"
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * Mobile transaction card — every column's information stays accessible in a
 * compact stacked layout (employees often use the app from their phones).
 */
export function IssuedTransactionCard({ transaction: t, onAction }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <div className="flex items-center justify-between gap-3">
        <EmployeeCell
          name={t.employee}
          role={t.employee_role}
          avatarUrl={t.avatar_url}
        />
        <StatusBadge status={t.status} />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-[var(--ink)]">
            {t.description}
          </p>
          {t.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-muted)]">
              {t.notes}
            </p>
          )}
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <MethodIcon method={t.method} />
          <span className="truncate">{methodLabel(t.method)}</span>
        </span>
        {t.source_of_funds && (
          <span className="flex min-w-0 items-center gap-1.5">
            <HandCoins
              size={12}
              strokeWidth={2.25}
              className="shrink-0 text-[var(--accent-strong)]"
              aria-hidden
            />
            <span className="min-w-0 truncate capitalize">
              {t.source_of_funds}
            </span>
          </span>
        )}
        <span className="shrink-0 tabular-nums">
          {formatDate(t.date_issued)} · {formatTime(t.date_issued)}
        </span>
        <span className="ml-auto shrink-0">
          <IssuedTransactionActions transaction={t} onAction={onAction} />
        </span>
      </div>
    </div>
  );
}
