import {
  CalendarDays,
  FileText,
  Image as ImageIcon,
  TriangleAlert,
} from "lucide-react";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "@/lib/utils";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import { ExpenseMethodIcon } from "./ExpenseBadges";

const ReceiptDatePill = ({ formatted, danger, children }) => (
  <div
    className={cn(
      "flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-3 ring-1 ring-inset",
      danger
        ? "bg-[var(--danger)]/10 ring-[var(--danger)]/30"
        : "bg-[var(--accent-soft)]/50 ring-[var(--accent)]/25",
    )}
  >
    <span
      className={cn(
        "shrink-0",
        danger ? "text-[var(--danger)]" : "text-[var(--accent-strong)]",
      )}
    >
      {danger ? (
        <TriangleAlert size={14} aria-hidden />
      ) : (
        <CalendarDays size={14} aria-hidden />
      )}
    </span>
    <p className="min-w-0 flex-1 truncate text-xs tabular-nums">
      <span
        className={cn(
          "font-medium",
          danger ? "text-[var(--danger)]" : "text-[var(--ink-muted)]",
        )}
      >
        Receipt date ·{" "}
      </span>
      <span
        className={cn(
          "font-semibold",
          danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
        )}
      >
        {formatted}
      </span>
    </p>
    {children}
  </div>
);

// "Overview" tab of the expense details modal: flagged banner, amount hero,
// vendor/date/method/category/source/notes grid, and the quick-switch card
// that jumps to the receipt tab.
export function ExpenseDetailsOverview({
  row,
  vendorName,
  flagged,
  hasReceipt,
  receiptIsPdf,
  receiptCount,
  onShowReceipt,
}) {
  return (
    <div className="mt-4 space-y-3">
      {/* Flagged Banner (read-only for employees) */}
      {flagged && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/[0.1] px-4 py-3"
        >
          <TriangleAlert
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--warning)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--warning)]">
              Flagged for review
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--warning)]/90">
              This receipt is dated before the budget was issued to you — an
              admin will verify and approve it.
            </p>
          </div>
        </div>
      )}

      {/* Amount Hero Card */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
          <p className="mt-1 font-display text-2xl font-medium leading-none tracking-tight tabular-nums text-[var(--ink)]">
            {formatMoney(row?.amount)}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
            {[row?.category, methodLabel(row?.method)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <ExpenseStatusBadge status={row?.status} className="shrink-0" />
      </div>

      {/* Receipt Quick Preview Link Card */}
      {hasReceipt && (
        <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 text-left transition-colors ">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                {receiptIsPdf ? (
                  <FileText size={16} />
                ) : (
                  <ImageIcon size={16} />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--ink)]">
                  {receiptIsPdf
                    ? "PDF receipt document attached"
                    : "Receipt image attached"}
                </p>
                <p className="truncate text-[11px] text-[var(--ink-muted)]">
                  {receiptCount > 0
                    ? `${receiptCount} itemized lines scanned · View receipt`
                    : "Click to inspect receipt document"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onShowReceipt}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]/90 px-2.5 py-1 text-xs font-normal text-[var(--ink)] shadow-2xs"
            >
              View receipt →
            </button>
          </div>
          {/* Receipt date gets its own full-width row so the value
                                                reads at a glance and the editor has room to breathe. */}
          {(row?.receiptDate ?? row?.receipt_date) && (
            <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
              <ReceiptDatePill
                formatted={`${formatDate(row.receiptDate ?? row.receipt_date)} · ${formatTime(row.receiptDate ?? row.receipt_date)}`}
                danger={Boolean(row?.flagged)}
              />
            </div>
          )}
        </div>
      )}

      {/* Details Section */}
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        {/* Vendor / Description */}
        <div className="border-b border-[var(--border)] py-2.5 first:pt-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">
            Vendor / Description
          </p>
          <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)] normal-case">
            {vendorName || row?.description || "—"}
          </p>
          {vendorName && row?.description && vendorName !== row.description ? (
            <p className="mt-0.5 break-words text-xs text-[var(--ink-muted)]">
              {row.description}
            </p>
          ) : null}
        </div>

        {/* Date, Time, Method */}
        <div className="grid grid-cols-3 gap-3 border-b border-[var(--border)] py-2.5">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Date</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatDate(row?.date)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Time</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatTime(row?.date || row?.timeDate)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Method</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--ink)]">
              <span className="text-[var(--ink-muted)]">
                <ExpenseMethodIcon method={row?.method} />
              </span>
              <span className="truncate">{methodLabel(row?.method)}</span>
            </p>
          </div>
        </div>

        {/* Category & Source of Funds */}
        {(row?.category || row?.sourceOfFunds || row?.reference_label) && (
          <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] py-2.5">
            {row?.category ? (
              <div className="min-w-0">
                <p className="type-eyebrow text-[var(--ink-muted)]">Category</p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                  {row.category}
                </p>
              </div>
            ) : null}
            {row?.sourceOfFunds || row?.reference_label ? (
              <div className="min-w-0">
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  Source of Funds
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                  {row.sourceOfFunds || row.reference_label}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Notes */}
        {row?.notes ? (
          <div className="pt-2">
            <p className="type-eyebrow text-[var(--ink-muted)]">Category</p>
            <p className="mt-1 break-words text-sm text-[var(--ink)]">
              {row.notes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ExpenseDetailsOverview;
