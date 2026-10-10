import { Flag } from "lucide-react";
import { OVERVIEW_COLUMN_WIDTHS } from "@/constants";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";
import {
  getDateGroupLabel,
  getTypeBadge,
  hasOverviewReceipt,
  isCancelled,
  isCancelledIssued,
  isDraftExpense,
  isDraftOrCancelled,
  isFlagged,
  isNegative,
  isReceivedIssued,
  isSentTransfer,
  isTransfer,
  overviewConfigFor,
  transferCounterparty,
} from "@/lib/overviewLedger";
import { Badge } from "../../../ui/Badge";
import { ExpenseStatusBadge } from "../../admin/expenses/ExpensesTable";
import { OverviewMethodBadge, OverviewReceiptBadge } from "./OverviewBadges";
import { OverviewRowActions } from "./OverviewRowActions";

// Status column: expenses in draft/cancel read their own status, issued rows
// are validated against the `issued_budget` row status — 'added' reads a
// success "Received" badge, 'cancel' reads a danger "Cancelled" identifier.
// Transfers read Sent/Transfer, settled abono reads Settled + date, open
// abono reads Open — everything else keeps the kind badge. Never contradicts
// the Type column (see getTypeBadge).
function StatusCell({ tx, meta }) {
  const transfer = isTransfer(tx);
  const sent = isSentTransfer(tx);
  if (isDraftOrCancelled(tx)) {
    // Draft / cancelled expenses show their own status —
    // the type badge's "Paid" would be wrong for them.
    return (
      <ExpenseStatusBadge
        status={tx.status}
        className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
      />
    );
  }
  if (isCancelledIssued(tx)) {
    // Cancelled issuance (`issued_budget.status = 'cancel'`): danger
    // identifier — the amount below strikes through in danger tone too.
    return (
      <Badge
        tone="danger"
        className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        <span className="truncate">Cancelled</span>
      </Badge>
    );
  }
  if (tx?.kind === "issued" || isReceivedIssued(tx)) {
    // Live issuance (`issued_budget.status = 'added'`): success "Received"
    // badge, mirroring the details body hero.
    return (
      <Badge
        tone="success"
        className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        <span className="truncate">Received</span>
      </Badge>
    );
  }
  if (transfer) {
    const Icon = meta.Icon;
    return (
      <Badge
        tone={sent ? "neutral" : meta.badgeTone}
        className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
      >
        <Icon size={12} strokeWidth={2.2} className="shrink-0" />
        <span className="truncate">{sent ? "Sent" : "Transfer"}</span>
      </Badge>
    );
  }
  if (tx?.kind === "abono" && tx?.status === "settled") {
    // Settled abono is closed out — accent "Settled"
    // badge with the settled date below. Unsettled
    // abono keeps the type badge below.
    return (
      <>
        <Badge
          tone="accent"
          className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          <span className="truncate">Settled</span>
        </Badge>
        {tx?.date_settled && (
          <p
            className="mt-1.5 truncate whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--ink-muted)]"
            title={`Settled on ${formatDate(tx.date_settled)} at ${formatTime(tx.date_settled)}`}
          >
            {formatDate(tx.date_settled)} · {formatTime(tx.date_settled)}
          </p>
        )}
      </>
    );
  }
  if (tx?.kind === "abono" && tx?.status === "open") {
    return (
      <Badge
        tone="warning"
        className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
      >
        <span className="h-2 w-2 rounded-full bg-current opacity-80" />
        <span className="truncate">Open</span>
      </Badge>
    );
  }
  return (
    <Badge
      tone={meta.badgeTone}
      className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
    >
      <span className="truncate">{meta.label}</span>
    </Badge>
  );
}

function OverviewTableRow({ tx, onView }) {
  const meta = overviewConfigFor(tx.kind);
  const transfer = isTransfer(tx);
  const sent = isSentTransfer(tx);
  const negative = isNegative(tx);
  const typeBadge = getTypeBadge(tx);
  const TypeIcon = typeBadge.Icon;
  const cancelledIssued = isCancelledIssued(tx);
  // A cancelled issuance is void money: danger amount + strikethrough. It
  // takes precedence over the live issued accent tone below.
  const amountColor = cancelledIssued
    ? "text-[var(--danger)]"
    : negative
      ? "text-[var(--danger)]"
      : tx.kind === "issued" || (!sent && transfer)
        ? "text-[var(--accent-strong)]"
        : "text-[var(--ink)]";
  const flagged = isFlagged(tx);
  const hasReceipt = hasOverviewReceipt(tx);

  return (
    <tr
      key={`${tx.kind}-${tx.id}`}
      className={cn(
        "relative transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]",
        // Same status tones as the mobile cards: draft warns,
        // cancelled reads danger. Flagged rows keep the normal
        // tone — the "Flagged" badge below carries that state.
        isDraftExpense(tx) &&
          "bg-[var(--warning)]/[0.08] hover:bg-[var(--warning)]/[0.12]",
        isCancelled(tx) &&
          "bg-[var(--danger)]/[0.08] hover:bg-[var(--danger)]/[0.12]",
      )}
      title={
        flagged
          ? "Flagged — dated before the first budget issued to you"
          : undefined
      }
    >
      <td className="relative px-4 py-3 first:pl-5 align-middle">
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-transparent"
        />
        <p className="whitespace-nowrap text-[13px] font-medium leading-none tabular-nums text-[var(--ink)]">
          {formatDate(tx.date)}
        </p>
        <p className="mt-1 whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(tx.date)}
        </p>
      </td>

      <td className="px-4 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-1.5">
          {flagged ? (
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
          ) : null}
          <p
            className="truncate text-[13px] font-medium leading-snug text-[var(--ink)]"
            title={transfer ? tx.reference_label || tx.description : tx.description}
          >
            {transfer
              ? tx.reference_label || tx.description || "—"
              : tx.description || "—"}
          </p>
        </div>
        {transfer && tx.notes && transferCounterparty(tx) ? (
          <p
            className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]"
            title={transferCounterparty(tx)}
          >
            {transferCounterparty(tx)}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-center">
          {hasReceipt ? <OverviewReceiptBadge /> : null}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge
          tone={typeBadge.tone}
          className="max-w-full gap-1.5 px-2 py-1 text-[11px]"
          title={typeBadge.label}
        >
          <TypeIcon
            size={12}
            strokeWidth={2.2}
            aria-hidden
            className="shrink-0"
          />
          <span className="truncate">{typeBadge.label}</span>
        </Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        <OverviewMethodBadge method={tx.method} className="max-w-full" />
      </td>
      <td className="px-4 py-3 align-middle">
        <StatusCell tx={tx} meta={meta} />
      </td>
      <td className="px-4 py-3 align-middle">
        <p
          className="whitespace-nowrap text-left text-[13px] font-normal leading-none text-[var(--ink)]"
          title={`${formatDate(tx.date)} at ${formatTime(tx.date)}`}
        >
          {getDateGroupLabel(tx.date)}
          <span aria-hidden className="mx-1.5 opacity-40">
            ·
          </span>
          <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
            {formatTime(tx.date)}
          </span>
        </p>
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <span
          className={cn(
            "whitespace-nowrap font-display text-[15px] font-medium tabular-nums",
            amountColor,
            (isCancelled(tx) || isCancelledIssued(tx)) && "line-through",
          )}
        >
          {negative ? `-${formatMoney(tx.amount)}` : `+${formatMoney(tx.amount)}`}
        </span>
      </td>
      <td className="px-4 py-3 pr-5 text-right align-middle">
        <div className="flex justify-end">
          <OverviewRowActions onView={() => onView(tx)} />
        </div>
      </td>
    </tr>
  );
}

export function OverviewTable({ rows, onView }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
        <caption className="sr-only">Employee all transactions list</caption>
        <colgroup>
          {OVERVIEW_COLUMN_WIDTHS.map((width, i) => (
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
              Type
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Method
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Status
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
              Day
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
              Amount
            </th>
            <th className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((tx) => (
            <OverviewTableRow
              key={`${tx.kind}-${tx.id}`}
              tx={tx}
              onView={onView}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OverviewTable;
