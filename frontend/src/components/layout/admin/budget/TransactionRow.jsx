import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { ApproverCell } from "./ApproverCell";
import { PaymentMethod, methodLabel } from "./PaymentMethod";
import { TransactionActions } from "./TransactionActions";
import { BanknoteCheck } from "lucide-react";

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
    <tr className=" border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/60">
      {/* Description */}
      <td className="px-4 py-3 pl-5 align-middle">
        <p className="text-sm font-semibold leading-snug text-[var(--ink)]">
          {t.description}
        </p>

        {t.label && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <BanknoteCheck size={15} className="shrink-0" strokeWidth={2} />
            <span className="min-w-0 truncate capitalize">{t.label}</span>
          </p>
        )}
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right align-middle">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </td>

      {/* Payment Method */}
      <td className="px-4 py-3 align-middle">
        <Badge tone="neutral" className="capitalize">
          <PaymentMethod method={t.method} />
        </Badge>
      </td>

      {/* Approved By */}
      <td className="px-4 py-3 align-middle">
        <ApproverCell name={t.approved_by} approvedAt={t.approved_at} />
      </td>

      {/* Date */}
      <td className="px-4 py-3 align-middle">
        <p className="text-xs leading-none tabular-nums text-[var(--ink)]">
          {formatDate(t.created_at)}
        </p>

        <p className="mt-1 text-[10px] leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(t.created_at)}
        </p>
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center align-middle">
        <StatusBadge status={t.status} />
      </td>

      {/* Actions */}
      <td className="w-[1%] px-4 py-3 pr-5 text-right align-middle">
        <div className="flex justify-end transition-opacity duration-150 ">
          <TransactionActions
            transaction={t}
            role={role}
            onAction={onAction}
            valueRemaining={valueRemaining}
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
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
        <span className="text-base font-bold text-[var(--ink)] tabular">
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
        <span className={cn("ml-auto shrink-0 tabular")}>
          {formatDate(t.created_at)} · {formatTime(t.created_at)}
        </span>
      </div>
    </div>
  );
}
