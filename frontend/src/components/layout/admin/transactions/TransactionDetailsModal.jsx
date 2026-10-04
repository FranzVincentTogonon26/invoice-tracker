import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ReceiptText, TriangleAlert, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";
import { TRANSACTION_KIND_META } from "./TransactionsTable";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const PersonRow = ({ row }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
    <EmployeeAvatar
      name={row?.employeeName}
      avatarUrl={row?.employeeAvatar}
      className="h-8 w-8 shrink-0 text-xs"
    />
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold leading-tight text-[var(--ink)]">
        {row?.employeeName || "Unknown"}
      </p>
      <p className="mt-0.5 truncate text-[11px] capitalize text-[var(--ink-muted)]">
        {row?.employeeRole || "Account"}
      </p>
    </div>
  </div>
);

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
  const KindIcon = meta?.Icon ?? ReceiptText;
  const title = meta?.label ?? "Transaction details";
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
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />

          <motion.div
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto scrollbar-slim rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover outline-none sm:p-6 transition-all duration-200"
          >
            {/* ── Dialog Header ── */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  row?.flagged
                    ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                )}
              >
                <KindIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  id={titleId}
                  className="truncate font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                >
                  {title}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatDate(row?.date)}
                  {row?.date ? ` · ${formatTime(row.date)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close transaction details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Dialog Body ── */}
            <div className="mt-4 space-y-3">
              {/* Flagged Banner */}
              {row?.flagged ? (
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
                      This record was marked for review. Please verify the
                      details before acting on it.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Amount Hero Card */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    {row.direction === "in"
                      ? "Amount received"
                      : row.direction === "out"
                        ? "Amount moved out"
                        : "Recorded amount"}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums",
                      row.direction === "in" && "text-[var(--success)]",
                      row.direction === "out" && "text-[var(--danger)]",
                      row.direction !== "in" &&
                        row.direction !== "out" &&
                        "text-[var(--ink)]",
                    )}
                  >
                    {row.direction === "in"
                      ? "+"
                      : row.direction === "out"
                        ? "−"
                        : ""}
                    {formatMoney(row.amount)}
                  </p>
                  <p className="mt-1.5 truncate text-xs text-[var(--ink-muted)]">
                    {[meta?.label, methodLabel(row?.method)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={directionMeta.tone}>{directionMeta.label}</Badge>
                  <StatusBadge status={row.status} />
                </div>
              </div>

              {/* Details Section */}
              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3.5">
                {/* Description — hidden for transfer legs, whose description
                    is auto-generated ("Budget transfer to/from …") and adds
                    no information beyond the To/From row */}
                {row.description &&
                title !== "Transfer Sent" &&
                title !== "Transfer Received" ? (
                  <div className="border-b border-[var(--border)] py-2.5 first:pt-0">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Description
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-snug text-[var(--ink)] normal-case">
                      {row.description}
                    </p>
                  </div>
                ) : null}

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
                      {formatTime(row?.date)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Method
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[var(--ink)]">
                      {row?.method ? (
                        <>
                          <span className="shrink-0 text-[var(--ink-muted)]">
                            <MethodIcon
                              method={row.method}
                              className="h-4 w-4"
                            />
                          </span>
                          <span className="truncate">
                            {methodLabel(row.method)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--ink-muted)]">—</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Category & Source of Funds — collapses to one column when
                    only one of them exists */}
                {row?.categoryName || row?.referenceLabel ? (
                  <div
                    className={cn(
                      "grid gap-3 border-b border-[var(--border)] py-2.5",
                      row?.categoryName && row?.referenceLabel
                        ? "grid-cols-3"
                        : "grid-cols-1",
                    )}
                  >
                    {row?.categoryName ? (
                      <div className="min-w-0">
                        <p className="type-eyebrow text-[var(--ink-muted)]">
                          Category
                        </p>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                          {row.categoryName}
                        </p>
                      </div>
                    ) : null}
                    {row?.referenceLabel ? (
                      <div className="min-w-0">
                        <p className="truncate type-eyebrow text-[var(--ink-muted)]">
                          Source of Funds
                        </p>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                          {row.referenceLabel}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Account / Person */}
                <div className="py-2.5">
                  <p className="mb-2 type-eyebrow text-[var(--ink-muted)]">
                    Account / Person
                  </p>
                  {row.employeeName ? (
                    <PersonRow row={row} />
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--ink-muted)]"
                      >
                        B
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold leading-tight text-[var(--ink)]">
                          Boss
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                          {row.approvedBy
                            ? `By ${row.approvedBy}`
                            : "Allocation"}
                        </p>
                      </div>
                    </div>
                  )}
                  {row.counterpartyName ? (
                    <p className="mt-2 truncate text-xs text-[var(--ink-muted)]">
                      {row.kind === "transfer_sent"
                        ? "To"
                        : row.kind === "transfer_received"
                          ? "From"
                          : "Person involved"}
                      :{" "}
                      <span className="font-medium text-[var(--ink)]">
                        {row.counterpartyName}
                      </span>
                      {row.counterpartyRole ? ` (${row.counterpartyRole})` : ""}
                    </p>
                  ) : null}
                </div>

                {/* Expense date / Date settled — Date settled is hidden for
                    Expense rows; collapses to one column when only one of
                    them is shown */}
                {row?.expenseDate ||
                (row?.dateSettled && title !== "Expense") ? (
                  <div
                    className={cn(
                      "grid gap-3 border-t border-[var(--border)] py-2.5",
                      row?.expenseDate &&
                        row?.dateSettled &&
                        title !== "Expense"
                        ? "grid-cols-2"
                        : "grid-cols-1",
                    )}
                  >
                    {row?.expenseDate ? (
                      <div className="min-w-0">
                        <p className="type-eyebrow text-[var(--ink-muted)]">
                          Expense date
                        </p>
                        <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                          {formatDate(row.expenseDate)}
                        </p>
                      </div>
                    ) : null}
                    {row?.dateSettled && title !== "Expense" ? (
                      <div className="min-w-0">
                        <p className="type-eyebrow text-[var(--ink-muted)]">
                          Date settled
                        </p>
                        <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                          {formatDate(row.dateSettled)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Notes */}
                {row?.notes ? (
                  <div className="pt-3 border-t border-[var(--border)] ">
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Notes
                    </p>
                    <p className="mt-1 break-words text-sm text-[var(--ink)]">
                      {row.notes}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Dialog Footer ── */}
            <div className="mt-5 flex items-center justify-end border-t border-[var(--border)] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-full px-5 text-xs font-semibold"
              >
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
