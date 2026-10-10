import { Badge } from "../../../ui/Badge";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import { OVERVIEW_TYPE_LABEL_SHORT } from "@/constants";
import { cn, formatMoney } from "@/lib/utils";
import {
  formatShortDate,
  hasOverviewReceipt,
  isCancelled,
  isCancelledIssued,
  isDraftExpense,
  isDraftOrCancelled,
  isFlagged,
  isNegative,
  isSentTransfer,
  isTransfer,
  overviewConfigFor,
} from "@/lib/overviewLedger";
import { OverviewReceiptBadge } from "./OverviewBadges";

function OverviewMobileCard({ tx, onOpen }) {
  const meta = overviewConfigFor(tx.kind);
  const negative = isNegative(tx);
  const sent = isSentTransfer(tx);
  const cancelledIssued = isCancelledIssued(tx);
  // A cancelled issuance is void money: danger amount + strikethrough,
  // taking precedence over the live issued accent tone.
  const amountColor = cancelledIssued
    ? "text-[var(--danger)]"
    : negative
      ? "text-[var(--danger)]"
      : tx.kind === "issued" || (!sent && isTransfer(tx))
        ? "text-[var(--accent-strong)]"
        : "text-[var(--warning)]";
  const flagged = isFlagged(tx);
  const hasReceipt = hasOverviewReceipt(tx);

  return (
    <div
      onClick={() => onOpen(tx)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest("button")) return;
        e.preventDefault();
        onOpen(tx);
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${tx.description || meta.label}`}
      className={cn(
        "relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3.5 transition-shadow hover:shadow-card active:scale-[0.99]",
        // Status tone drives the card: draft warns,
        // cancelled reads danger. Flagged rows keep the
        // normal tone — the "Flagged" pill badge below
        // carries that state instead.
        isDraftExpense(tx) &&
          "border-[var(--warning)]/50 bg-[var(--warning)]/[0.08]",
        isCancelled(tx) &&
          "border-[var(--danger)]/40 bg-[var(--danger)]/[0.08]",
        cancelledIssued &&
          "border-[var(--danger)]/40 bg-[var(--danger)]/[0.08]",
      )}
      title={
        flagged
          ? "Flagged — dated before the first budget issued to you"
          : undefined
      }
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-transparent"
      />
      {/* Left: Icon & Details matching requested mobile structure */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium leading-none text-[var(--ink)]">
            <span className="min-w-0 truncate capitalize">
              {tx.description || meta.label}
            </span>
            {isDraftOrCancelled(tx) && (
              <ExpenseStatusBadge
                status={tx.status}
                className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
              />
            )}
            {flagged && (
              <Badge
                tone="warning"
                className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                title="Flagged — dated before the first budget issued to you"
              >
                Flagged
              </Badge>
            )}
            {isCancelledIssued(tx) && (
              <Badge
                tone="danger"
                className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]"
                title="Cancelled — this issuance no longer funds your balance"
              >
                Cancelled
              </Badge>
            )}
          </p>
          {/* Meta row: type · short date · method badge */}
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
            <span className="shrink-0">
              {isTransfer(tx) && tx?.direction === "received"
                ? "Received"
                : (OVERVIEW_TYPE_LABEL_SHORT[tx.kind] ?? meta.label)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="shrink-0 tabular-nums">
              {formatShortDate(tx.date)}
            </span>
            <span aria-hidden className="shrink-0 opacity-40">
              |
            </span>
            <span className="truncate text-[10px] type-eyebrow">
              {tx.method}
            </span>
            {hasReceipt && (
              <OverviewReceiptBadge className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]" />
            )}
          </p>
        </div>
      </div>

      {/* Right: Amount & Status */}
      <div className="text-right shrink-0">
        <p
          className={cn(
            "font-display text-sm font-medium tabular-nums",
            amountColor,
            (isCancelled(tx) || isCancelledIssued(tx)) && "line-through",
          )}
        >
          {negative ? `-${formatMoney(tx.amount)}` : `+${formatMoney(tx.amount)}`}
        </p>
      </div>
    </div>
  );
}

export function OverviewMobileList({ groups, onOpen }) {
  return (
    <>
      {groups.map(({ label, transactions }) => (
        <div key={label} className="space-y-2.5">
          <h4 className="px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            {label}
          </h4>
          {transactions.map((tx) => (
            <OverviewMobileCard
              key={`${tx.kind}-${tx.id}`}
              tx={tx}
              onOpen={onOpen}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export default OverviewMobileList;
