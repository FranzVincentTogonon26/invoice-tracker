import { Flag } from "lucide-react";
import { EXPENSES_COLUMN_WIDTHS } from "@/constants";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";
import {
  expenseConfigFor,
  getExpenseDaysLabel,
  hasExpenseReceipt,
  isExpenseFlagged,
} from "@/lib/expenseLedger";
import { Badge } from "../../../ui/Badge";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import { ExpenseMethodBadge, ExpenseReceiptBadge } from "./ExpenseBadges";
import { ExpenseRowActions } from "./ExpenseRowActions";

function ExpenseSectionTableRow({
  tx,
  pending,
  onView,
  onDelete,
  canDelete,
  canManageDraft,
  onAddToDraft,
  onRestoreFromDraft,
}) {
  const meta = expenseConfigFor(tx.kind);
  const Icon = meta.Icon;
  const flagged = isExpenseFlagged(tx);
  const daysLabel = getExpenseDaysLabel(tx.date);
  const hasReceipt = hasExpenseReceipt(tx);

  return (
    <tr
      className={cn(
        "relative transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]",
        tx.status === "cancel" &&
          "bg-[var(--danger)]/[0.08] hover:bg-[var(--danger)]/[0.12]",
      )}
      title={
        flagged
          ? "Flagged — dated before the first budget issued to you"
          : undefined
      }
    >
      <td className="relative px-4 py-3 first:pl-5 align-middle">
        <p className="whitespace-nowrap text-[13px] font-medium leading-none tabular-nums text-[var(--ink)]">
          {formatDate(tx.date)}
        </p>
        <p className="mt-1 whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(tx.date)}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-1.5">
          {flagged && (
            <span
              role="img"
              aria-label="Flagged transaction"
              title="Flagged"
              className="relative flex h-5 w-5 shrink-0"
            >
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-40"
              />
              <Badge
                tone="danger"
                className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] p-0 text-white"
              >
                <Flag size={10} aria-hidden fill="currentColor" />
              </Badge>
            </span>
          )}
          <p
            className="normal-case text-[13px] font-medium leading-snug text-[var(--ink)]"
            title={tx.reference_label || tx.description}
          >
            {tx.description}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-center">
          {hasReceipt ? <ExpenseReceiptBadge /> : null}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <ExpenseMethodBadge method={tx.method} className="max-w-full" />
      </td>
      <td className="px-4 py-3 align-middle">
        {tx.status ? (
          <ExpenseStatusBadge
            status={tx.status}
            className="max-w-full px-2 py-1 text-[11px]"
          />
        ) : (
          <Badge
            tone={meta.badgeTone}
            className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
          >
            <Icon size={12} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate">{meta.label}</span>
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <p
          className="flex flex-row items-center gap-1.5 whitespace-nowrap leading-none"
          title={`${formatDate(tx.date)} at ${formatTime(tx.date)}`}
        >
          <span
            className={cn(
              "text-[13px] font-normal",
              daysLabel === "Today"
                ? "text-[var(--accent-strong)]"
                : "text-[var(--ink)]",
            )}
          >
            {daysLabel}
          </span>
          <span
            aria-hidden
            className="shrink-0 text-[var(--ink-muted)] opacity-40"
          >
            ·
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-muted)]">
            {formatTime(tx.date)}
          </span>
        </p>
      </td>
      <td className="px-4 py-3 text-right last:pr-5 align-middle">
        <span
          className={cn(
            "whitespace-nowrap font-display text-[15px] font-medium tabular-nums",
          )}
        >
          {formatMoney(tx.amount)}
        </span>
      </td>
      <td className="px-4 py-4 pr-5 text-right align-middle">
        <div className="flex justify-end">
          <ExpenseRowActions
            row={tx}
            pending={pending}
            onView={onView}
            onDelete={onDelete}
            canDelete={canDelete}
            canManageDraft={canManageDraft}
            onAddToDraft={onAddToDraft}
            onRestoreFromDraft={onRestoreFromDraft}
          />
        </div>
      </td>
    </tr>
  );
}

export function ExpenseSectionTable({
  rows,
  pending,
  onView,
  onDelete,
  canDelete,
  canManageDraft,
  onAddToDraft,
  onRestoreFromDraft,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
        <caption className="sr-only">
          Employee all transactions list with relative day and time
        </caption>
        <colgroup>
          {EXPENSES_COLUMN_WIDTHS.map((width, i) => (
            <col key={i} style={{ width }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]">
          <tr>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-5">
              Date
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Description
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              <span className="sr-only">Receipt</span>
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Payment Method
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Status
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Days
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
              Amount
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((tx) => (
            <ExpenseSectionTableRow
              key={`${tx.kind}-${tx.id}`}
              tx={tx}
              pending={pending}
              onView={onView}
              onDelete={onDelete}
              canDelete={canDelete}
              canManageDraft={canManageDraft}
              onAddToDraft={onAddToDraft}
              onRestoreFromDraft={onRestoreFromDraft}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ExpenseSectionTable;
