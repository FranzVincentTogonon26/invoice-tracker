import { ArrowLeftRight, Flag, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import { cn, formatDate, formatMoney, formatTime, methodLabel } from "@/lib/utils";
import {
  isCancelled,
  isCancelledIssued,
  isDraftExpense,
  isDraftOrCancelled,
  isFlagged,
  isSentTransfer,
  isTransfer,
  transferCounterparty,
} from "@/lib/overviewLedger";

/* ── Mobile detail sheet body — amount hero + summary rows per kind ── */
// Mirrors the budget ledger's IssuedDetailsBody: one amount hero on top,
// then type-specific summaries below. Read-only — overview never edits.
export function OverviewDetailsBody({ row, meta }) {
  const flagged = isFlagged(row);
  const kind = row?.kind;
  const transfer = isTransfer(row);
  const sent = isSentTransfer(row);
  const counterparty = transferCounterparty(row);
  const sign = row?.kind === "expense" || sent ? "-" : "+";
  const statusBadge =
    kind === "issued" ? (
      row?.status === "cancel" ? (
        <Badge tone="danger">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Cancelled
        </Badge>
      ) : (
        <Badge tone="success">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Received
        </Badge>
      )
    ) : kind === "abono" ? (
      // A settled abono is closed out (reimbursed) — accent tone + explicit
      // "Settled Abono" wording so it never reads like live money.
      row?.status === "settled" ? (
        <Badge tone="accent">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Settled Abono
        </Badge>
      ) : (
        <Badge tone="warning">
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Open
        </Badge>
      )
    ) : transfer ? (
      <Badge tone={sent ? "neutral" : "success"}>
        <ArrowLeftRight size={12} aria-hidden className="shrink-0" />
        {sent ? "Sent" : "Received"}
      </Badge>
    ) : isDraftOrCancelled(row) ? (
      // Only draft / cancelled expenses add a status badge here — a paid row
      // keeps the plain "Paid" pill it always had.
      <ExpenseStatusBadge status={row.status} />
    ) : (
      <Badge tone="neutral">
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        Paid
      </Badge>
    );
  const summaryLabel =
    kind === "issued"
      ? "Received"
      : kind === "abono"
        ? "Abono"
        : transfer
          ? counterparty || "Transfer"
          : "Spent";
  return (
    <div className="mt-4 space-y-3">
      {flagged && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/[0.1] px-4 py-3"
        >
          <Flag
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--warning)]"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--warning)]">
              Flagged for review
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--warning)]/90">
              Dated before the first budget issued to you — an admin needs to
              approve it.
            </p>
          </div>
        </div>
      )}
      {isCancelled(row) && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/[0.1] px-4 py-3"
        >
          <XCircle
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--danger)]"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--danger)]">
              Expense cancelled
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--danger)]/90">
              An admin cancelled your expense — it is not part of your expenses
              and no longer counts toward your spending.
            </p>
          </div>
        </div>
      )}
      {isDraftExpense(row) && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/[0.1] px-4 py-3"
        >
          <ShieldAlert
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--danger)]"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--danger)]">
              Under review
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--danger)]/90">
              Your expense is under review due to suspicious activity — an admin
              will approve or cancel it.
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Amount</p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-medium leading-none tracking-tight tabular-nums text-[var(--ink)]",
              isCancelledIssued(row) && "line-through",
            )}
          >
            {sign}
            {formatMoney(row?.amount)}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
            {[summaryLabel, methodLabel(row?.method)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {statusBadge}
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
        <div className="border-b border-[var(--border)] py-3 first:pt-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Description</p>
          <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)] normal-case">
            {row?.description || meta?.label || "—"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 py-1">
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Date</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatDate(row?.date)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Time</p>
            <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
              {formatTime(row?.date)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-[var(--ink-muted)]">Method</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
              {methodLabel(row?.method)}
            </p>
          </div>
        </div>
        {/* Transfer rows read who the money moved to / came from, plus the
            sender's notes when the description shows them. */}
        {transfer && (counterparty || row?.notes) ? (
          <div className="grid gap-3 border-t border-[var(--border)] pt-3 py-1">
            {counterparty && (
              <div className="min-w-0">
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  {sent ? "Sent to" : "Received from"}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                  {row.counterparty}
                </p>
              </div>
            )}
          </div>
        ) : null}
        {kind === "abono" && row?.status === "settled" && row?.date_settled ? (
          <div className="grid grid-cols-3 border-t border-[var(--border)] pt-3 py-1">
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                Date Settled
              </p>
              <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                {formatDate(row?.date_settled)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">Time</p>
              <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                {formatTime(row?.date_settled)}
              </p>
            </div>
          </div>
        ) : null}
        {/* Cancelled expenses read their own (void/remarks) note on this row —
            other kinds carry no expense note. */}
        {kind === "expense" && row?.status === "cancel" ? (
          <div className="grid border-t border-[var(--border)] pt-3 py-1">
            <div className="min-w-0">
              <p className="type-eyebrow text-[var(--ink-muted)]">Notes</p>
              <p className="mt-1  text-sm font-medium tabular-nums text-[var(--ink)]">
                {row?.notes || "—"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default OverviewDetailsBody;
