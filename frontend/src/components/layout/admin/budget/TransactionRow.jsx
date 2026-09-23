import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { ApproverCell } from "./ApproverCell";
import { PaymentMethod, methodLabel } from "./PaymentMethod";
import { TransactionActions } from "./TransactionActions";

/**
 * Desktop table row. `<tr>` cells follow the fixed column proportions set in
 * `TransactionTable` — Description · Amount (right) · Method · Approved By ·
 * Date Added · Status (center) · Actions (right).
 */
export function TransactionRow({
  transaction: t,
  role,
  onAction,
  valueRemaining,
}) {
  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]">
      {/* Description */}
      <td className="relative px-4 py-3.5 pl-5 align-middle">
        {/* Accent flight that fades in on row hover */}
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--accent-strong)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
        <p className="text-base font-semibold leading-snug text-[var(--ink)]">
          {t.description}
        </p>

        {t.label && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
            <span className="min-w-0 truncate capitalize">{t.label}</span>
          </p>
        )}
      </td>

      {/* Amount */}
      <td className="px-4 py-3.5 text-right align-middle">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </td>

      {/* Payment Method */}
      <td className="px-4 py-3.5 align-middle">
        <Badge tone="neutral" className="capitalize">
          <PaymentMethod method={t.method} />
        </Badge>
      </td>

      {/* Approved By */}
      <td className="px-4 py-3.5 align-middle">
        <ApproverCell name={t.approved_by} approvedAt={t.approved_at} />
      </td>

      {/* Date */}
      <td className="px-4 py-3.5 align-middle">
        <p className="text-sm leading-none tabular-nums text-[var(--ink)]">
          {formatDate(t.created_at)}
        </p>

        <p className="mt-1 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(t.created_at)}
        </p>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5 text-center align-middle">
        <StatusBadge status={t.status} />
      </td>

      {/* Actions */}
      <td className="w-[1%] px-4 py-3.5 pr-5 text-right align-middle">
        <div className="flex justify-end transition-opacity duration-150">
          <TransactionActions
            transaction={t}
            role={role}
            onAction={onAction}
            valueRemaining={valueRemaining}
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
export function TransactionCard({
  transaction: t,
  role,
  onAction,
  valueRemaining,
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-[var(--ink)]">
            {t.description}
          </p>
          {t.label && (
            <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
              Source: <span className="capitalize">{t.label}</span>
            </p>
          )}
        </div>
        <TransactionActions
          transaction={t}
          role={role}
          onAction={onAction}
          valueRemaining={valueRemaining}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-[var(--ink)] tabular-nums">
          {formatMoney(t.amount)}
        </span>
        <StatusBadge status={t.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <MethodIcon method={t.method} />
          <span className="truncate">{methodLabel(t.method)}</span>
        </span>
        <span className="min-w-0 truncate">
          {t.approved_by?.trim() || "Unassigned"}
        </span>
        <span className={cn("ml-auto shrink-0 tabular-nums")}>
          {formatDate(t.created_at)} · {formatTime(t.created_at)}
        </span>
      </div>
    </div>
  );
}
