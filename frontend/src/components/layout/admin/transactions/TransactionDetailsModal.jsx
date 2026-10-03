import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ReceiptText, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";
import { TRANSACTION_KIND_META } from "./TransactionsTable";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-[var(--ink)]">
        {children}
      </dd>
    </div>
  );
}

// Read-only ledger inspector — every important field of one unified row in
// plain language: what moved, how much, which direction, whose account it is
// attributed to, who the other party is, and which source of funds it came
// from. Transfer legs always name their counterparty so the two legs of one
// transfer can be told apart at a glance.
const TransactionDetailsModal = ({ open, row, onClose }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const meta = row ? (TRANSACTION_KIND_META[row.kind] ?? null) : null;
  const directionMeta =
    row?.direction === "in"
      ? { tone: "success", label: "Money In" }
      : row?.direction === "out"
        ? { tone: "danger", label: "Money Out" }
        : { tone: "neutral", label: "No movement" };

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <motion.div
          key="transaction-details"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <ReceiptText size={20} aria-hidden />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <h2
              id={titleId}
              className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
            >
              {meta?.label ?? "Transaction details"}
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--ink-muted)]">
              {row.description || "Untitled"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={directionMeta.tone}>{directionMeta.label}</Badge>
              <StatusBadge status={row.status} />
              {row.flagged && (
                <Badge tone="danger" title="Flagged for review">
                  Red Flag
                </Badge>
              )}
            </div>

            <div
              className={cn(
                "mt-4 rounded-2xl border border-[var(--border)] px-4 py-3 text-center",
                row.direction === "in" && "bg-[var(--success)]/8",
                row.direction === "out" && "bg-[var(--danger)]/8",
              )}
            >
              <p className="type-eyebrow text-[var(--ink-muted)]">
                {row.direction === "in"
                  ? "Amount received"
                  : row.direction === "out"
                    ? "Amount moved out"
                    : "Recorded amount"}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-3xl font-semibold tracking-tight tabular-nums",
                  row.direction === "in" && "text-[var(--success)]",
                  row.direction === "out" && "text-[var(--danger)]",
                  row.direction === "void" && "text-[var(--ink)]",
                )}
              >
                {row.direction === "in" ? "+" : row.direction === "out" ? "−" : ""}
                {formatMoney(row.amount)}
              </p>
              {row.direction === "void" && (
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  This record is parked or void, so it moves no money.
                </p>
              )}
            </div>

            <dl className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              <DetailRow label="Date">
                {formatDate(row.date)}{" "}
                <span className="text-xs text-[var(--ink-muted)]">
                  · {formatTime(row.date)}
                </span>
              </DetailRow>
              {row.description && (
                <DetailRow label="Description">
                  <span className="break-words">{row.description}</span>
                </DetailRow>
              )}
              {row.notes && (
                <DetailRow label="Notes">
                  <span className="break-words">{row.notes}</span>
                </DetailRow>
              )}
              <DetailRow label="Reference">
                {row.referenceLabel || "—"}
              </DetailRow>
              {row.categoryName && (
                <DetailRow label="Category">{row.categoryName}</DetailRow>
              )}
              {row.method && (
                <DetailRow label="Method">
                  <span className="inline-flex items-center gap-1.5">
                    <MethodIcon method={row.method} className="h-4 w-4" />
                    {methodLabel(row.method)}
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Employee">
                {row.employeeName
                  ? `${row.employeeName}${row.employeeRole ? ` · ${row.employeeRole}` : ""}`
                  : "System"}
              </DetailRow>
              {row.kind === "budget" && row.approvedBy && (
                <DetailRow label="Approved by">{row.approvedBy}</DetailRow>
              )}
              {row.counterpartyName && (
                <DetailRow
                  label={
                    row.kind === "transfer_sent"
                      ? "Sent to"
                      : row.kind === "transfer_received"
                        ? "Received from"
                        : "Person involved"
                  }
                >
                  {row.counterpartyName}
                  {row.counterpartyRole
                    ? ` · ${row.counterpartyRole}`
                    : ""}
                </DetailRow>
              )}
              {row.expenseDate && (
                <DetailRow label="Expense date">
                  {formatDate(row.expenseDate)}
                </DetailRow>
              )}
              {row.dateSettled && (
                <DetailRow label="Date settled">
                  {formatDate(row.dateSettled)}
                </DetailRow>
              )}
            </dl>

            <div className="mt-5 flex items-center justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default TransactionDetailsModal;
