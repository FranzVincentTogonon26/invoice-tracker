import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { EmployeeStatusBadge } from "./EmployeesTable";
import { budgetBreakdown } from "./employeeBudget";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const Stat = ({ label, value, danger = false }) => (
  <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
    <p className="type-eyebrow text-[var(--ink-muted)]">{label}</p>
    <p
      className={cn(
        "mt-1 truncate font-display text-base font-semibold tabular-nums",
        danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
      )}
    >
      {value}
    </p>
  </div>
);

/**
 * Read-only employee profile opened from the row-action dropdown's "View
 * employee" item. Everything shown comes straight from the ledger row already
 * in memory (identity, account state, budget aggregates) — no extra fetch.
 */
const EmployeeProfileModal = ({ employee, open, onClose }) => {
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

  // Same issued / spent / remaining breakdown the Employees table renders
  // (server-computed from the employee's own user_id with the Employee
  // Overview definitions) — the modal is opened from that row, so the numbers
  // must match exactly.
  const { issued, spent, remaining } = budgetBreakdown(employee);
  const references = Number(employee?.issued_references) || 0;

  return createPortal(
    <AnimatePresence>
      {open && employee && (
        <motion.div
          key="employee-profile"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--ink)]/45 backdrop-blur-md sm:items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.26, ease: DIALOG_EASE }}
            className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover sm:mx-3 sm:rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              >
                <Eye size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="font-display truncate text-base font-semibold tracking-tight text-[var(--ink)]"
                >
                  Employee profile
                </h2>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  Read-only account summary
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close employee profile"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3">
                <EmployeeAvatar
                  name={employee.name}
                  avatarUrl={employee.avatar_url}
                  className="h-12 w-12 text-base ring-2"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold tracking-tight text-[var(--ink)]">
                    {employee.name || "Unnamed employee"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {employee.email || "—"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <EmployeeStatusBadge status={employee.status} />
                    <Badge tone="neutral" className="capitalize">
                      {employee.role || "—"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Issued budget" value={formatMoney(issued)} />
                <Stat label="Total spent" value={formatMoney(spent)} />
                <Stat
                  label="Remaining"
                  value={formatMoney(remaining)}
                  danger={remaining < 0}
                />
                <Stat
                  label="Transactions"
                  value={`${references} ${references === 1 ? "record" : "records"}`}
                />
              </div>

              <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                {employee.created_at
                  ? `Account created ${formatDate(employee.created_at)} · ${formatTime(employee.created_at)}`
                  : "Account creation date unavailable"}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
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

export default EmployeeProfileModal;
