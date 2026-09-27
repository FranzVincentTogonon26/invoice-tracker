import { motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import EmployeeActions from "./EmployeeActions";

// Column proportions — Employee gets the most space because it anchors the
// row (avatar + name + email), "Remaining" has to fit the progress bar and its
// caption, and Actions keeps room for the status button + delete trigger.
// Percentages sum to 100% so `table-fixed` never overflows the scroll
// container (sizing verified against the 1080px min-width).
const COLUMN_WIDTHS = [
  "20%", // Employee
  "11%", // Status
  "10%", // Issued Budget
  "10%", // Total Spent
  "15%", // Remaining (+ progress bar)
  "8%", // Transactions
  "9%", // Date Added
  "17%", // Actions
];

const HEADERS = [
  { label: "Employee" },
  { label: "Status", align: "center" },
  { label: "Issued Budget", align: "right" },
  { label: "Total Spent", align: "right" },
  { label: "Remaining" },
  { label: "Transactions", align: "center" },
  { label: "Date Added" },
  { label: "Actions", srOnly: true, align: "right" },
];

// Account status colors — `pending` intentionally uses the warning tone here
// (a queued, actionable state) while active/inactive re-use the global map.
const STATUS_TONES = {
  active: "success",
  pending: "warning",
  inactive: "neutral",
};

const STATUS_LABELS = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
};

export function EmployeeStatusBadge({ status, className }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status] ?? status ?? "—"}
    </Badge>
  );
}

/**
 * Budget breakdown for one employee record — a single source of truth shared
 * by the desktop table and the mobile cards so both always agree.
 *
 *   issued    → SUM(issued_budget.amount) handed out to the employee
 *               (`issued_budget` in the API response)
 *   spent     → SUM(expenses.total_amount) of PAID expenses recorded against
 *               the employee's `user_id` (`total_spent` in the API response;
 *               drafts and cancels are excluded server-side, matching the
 *               employee overview aggregates)
 *   remaining → issued budget minus total spent (negative = over-spent)
 *   share     → remaining balance as a share of the issued budget, clamped to
 *               0–100 exactly like the Budget page utilization bar
 */
function budgetBreakdown(employee) {
  const issued = Math.max(0, Number(employee.issued_budget) || 0);
  const spent = Math.max(0, Number(employee.total_spent) || 0);
  const remaining = issued - spent;
  const share =
    issued > 0 ? Math.min(100, Math.max(0, (remaining / issued) * 100)) : 0;

  return { issued, spent, remaining, share: Number(share.toFixed(1)) };
}

/**
 * Animated remaining-balance bar. Same formula, 0–100 semantics, gradient,
 * easing curve, duration and delay as the Budget page's "Share of budget
 * already issued" bar, so both screens read as one system.
 *
 * Presentation-only additions: a slimmer track (h-1) with an inset ring, and
 * theme-aware fill colours driven by the REAL balance:
 *   - normal      → accent fill (light gradient / dark bright-accent + glow)
 *   - exhausted   → full success fill + check once spent === issued
 *   - over budget → full danger fill + alert icon once spent > issued
 *
 * Special cases:
 *   - issued === 0 → empty track (nothing to measure a balance against).
 *   - spent === issued (remaining === 0) → the bar renders at 100% / full
 *     success state, because the budget has been fully drawn down — not
 *     because there is nothing to track.
 *   - spent > issued → the bar pins to 100% in the danger tier so an
 *     over-spent row can never read as a green "success" check.
 */
function RemainingProgress({
  remaining,
  issued,
  share,
  overSpent = false,
  label,
}) {
  // The bar has no issue to track against (issued === 0) → empty track.
  const noIssued = issued <= 0;
  // Spent more than issued → danger tier (no success check).
  const isOver = !noIssued && overSpent;
  // Issued budget equals the total spent, but there is still an issue to
  // measure against → success tier.
  const fullySpent = !noIssued && !isOver && remaining <= 0;
  // What the bar visually shows and reports via ARIA.
  const displayed = noIssued ? 0 : isOver || fullySpent ? 100 : Number(share);

  return (
    <div className="flex items-center gap-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayed}
        aria-label={label}
        aria-valuetext={
          noIssued
            ? "No issued budget tracked"
            : isOver
              ? "Budget exceeded"
              : fullySpent
                ? "Budget fully spent"
                : `${displayed}% remaining`
        }
        className="remaining-track h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${displayed}%` }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.2,
          }}
          className={cn(
            "remaining-fill h-full rounded-full",
            isOver && "is-over",
            fullySpent && "is-full",
          )}
        />
      </div>
      {isOver && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/12">
          <AlertCircle
            size={10}
            strokeWidth={3}
            aria-hidden
            className="text-[var(--danger)]"
          />
        </span>
      )}
      {fullySpent && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12">
          <Check
            size={10}
            strokeWidth={3}
            aria-hidden
            className="text-[var(--success)]"
          />
        </span>
      )}
    </div>
  );
}

/**
 * Compact percentage pill shown above the bar. Tone follows the real balance:
 * danger with "Over budget" when the employee spent more than issued, success
 * with "Fully spent" when the budget is exactly exhausted (issued === spent),
 * accent with "N% left" (or "100% left") otherwise.
 */
function SharePill({ remaining, issued, share, overSpent, className }) {
  // Fully spent: there is an issued budget to compare against, and nothing
  // remains (e.g. 1000 − 1000 = 0). This is the "budget exhausted" state,
  // rendered in the success tier with "Fully spent" rather than "0% left".
  const fullySpent = issued > 0 && remaining <= 0;

  const tone = overSpent
    ? "bg-[var(--danger)]/12 text-[var(--danger)]"
    : fullySpent
      ? "bg-[var(--success)]/12 text-[var(--success)]"
      : "bg-[var(--accent-soft)] text-[var(--accent-strong)]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        tone,
        className,
      )}
    >
      {overSpent ? (
        <AlertCircle size={10} aria-hidden />
      ) : fullySpent ? (
        <Check size={10} aria-hidden />
      ) : null}
      {overSpent
        ? "Over budget"
        : fullySpent
          ? "Fully spent"
          : share >= 100
            ? "100% left"
            : `${Number(share)}% left`}
    </span>
  );
}

/** Avatar circle with the employee's initial, name and email below it. */
function EmployeeCell({ employee }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-soft),var(--surface-2))] font-display text-sm font-semibold tracking-tight text-[var(--accent-strong)] ring-1 ring-inset ring-[var(--accent)]/15 transition-transform duration-200 group-hover:rotate-[-6deg] group-hover:scale-[1.06] group-hover:ring-[var(--accent)]/30">
        {employee.name?.trim()?.[0]?.toUpperCase() || "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold leading-snug tracking-tight text-[var(--ink)] transition-colors duration-150 group-hover:text-[var(--accent-strong)]">
          {employee.name}
        </p>
        <p className="mt-0.5 truncate text-sm leading-tight text-[var(--ink-muted)]">
          {employee.email}
        </p>
      </div>
    </div>
  );
}

/** Desktop table row. */
function EmployeeRow({ employee, pending, onAction }) {
  const { issued, spent, remaining, share } = budgetBreakdown(employee);
  // Spending more than the issued budget flips the remaining amount red — the
  // same signal the Budget page uses for over-issued references.
  const overSpent = remaining < 0;

  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40 hover:bg-[var(--accent)]/[0.04]">
      <td className="px-4 py-3.5 pl-5 align-middle">
        <EmployeeCell employee={employee} />
      </td>
      {/* Status */}
      <td className="px-4 py-4 text-center align-middle">
        <EmployeeStatusBadge status={employee.status} />
      </td>

      {/* Issued Budget */}
      <td className="px-4 py-4 text-right align-middle">
        <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(issued)}
        </p>
      </td>

      <td className="px-4 py-4 text-right align-middle">
        <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(spent)}
        </p>
        {overSpent && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--danger)]/12 px-2 py-0.5 text-xs font-medium leading-none text-[var(--danger)]">
            <AlertCircle size={10} aria-hidden />
            Over budget
          </span>
        )}
      </td>

      <td className="px-4 py-4 align-middle">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium tabular-nums",
              overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
            )}
          >
            {formatMoney(remaining)}
          </p>
          <SharePill
            remaining={remaining}
            issued={issued}
            share={share}
            overSpent={overSpent}
          />
        </div>
        <div className="mt-1.5">
          <RemainingProgress
            remaining={remaining}
            issued={issued}
            share={share}
            overSpent={overSpent}
            label={`Remaining balance for ${employee.name ?? "employee"}`}
          />
        </div>
      </td>

      {/* Transactions — issued budget references tied to this employee */}
      <td className="px-4 py-4 text-center align-middle">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--surface-2)] px-2 text-xs font-semibold tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--border)]">
          {Number(employee.issued_references) || 0}
        </span>
      </td>

      {/* Date Added */}
      <td className="px-4 py-4 align-middle">
        {employee.created_at ? (
          <div>
            <p className="text-sm leading-none tabular-nums text-[var(--ink)]">
              {formatDate(employee.created_at)}
            </p>
            <p className="mt-1 text-xs leading-none text-[var(--ink-muted)]">
              {formatTime(employee.created_at)}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-none text-[var(--ink-muted)]">—</p>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-4 pr-5 text-right align-middle">
        <EmployeeActions
          employee={employee}
          pending={pending}
          onAction={onAction}
        />
      </td>
    </tr>
  );
}

/** Label + value pair used in the mobile card's budget strip. */
function CardMetric({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="type-eyebrow text-[var(--ink-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold tabular-nums",
          tone === "danger" ? "text-[var(--danger)]" : "text-[var(--ink)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Mobile employee card — every column stays readable in a stacked layout. */
function EmployeeCard({ employee, pending, onAction }) {
  const { issued, spent, remaining, share } = budgetBreakdown(employee);
  const overSpent = remaining < 0;
  const references = Number(employee.issued_references) || 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div className="flex items-start justify-between gap-3">
        <EmployeeCell employee={employee} />
        <EmployeeStatusBadge status={employee.status} className="shrink-0" />
      </div>

      {/* Budget strip — issued / spent / remaining, mirroring the table */}
      <div className="mt-3.5 grid grid-cols-3 gap-3 rounded-xl bg-[var(--surface-2)]/60 p-3 ring-1 ring-inset ring-[var(--border)]">
        <CardMetric label="Issued" value={formatMoney(issued)} />
        <CardMetric label="Spent" value={formatMoney(spent)} />
        <CardMetric
          label="Remaining"
          value={formatMoney(remaining)}
          tone={overSpent ? "danger" : undefined}
        />
      </div>

      {/* Remaining-balance bar — the same animated component as the table row */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="type-eyebrow text-[var(--ink-muted)]">
            Remaining balance
          </p>
          <SharePill
            remaining={remaining}
            issued={issued}
            share={share}
            overSpent={overSpent}
          />
        </div>
        <RemainingProgress
          share={share}
          remaining={remaining}
          issued={issued}
          overSpent={overSpent}
          label={`Remaining balance for ${employee.name ?? "employee"}`}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3.5">
        <span className="text-xs tabular-nums text-[var(--ink-muted)]">
          {employee.created_at
            ? `${formatDate(employee.created_at)} · ${formatTime(employee.created_at)}`
            : "—"}
        </span>
        <Badge tone="neutral">
          {references} {references === 1 ? "reference" : "references"}
        </Badge>
        <span className="ml-auto">
          <EmployeeActions
            employee={employee}
            pending={pending}
            onAction={onAction}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Employees table.
 * Desktop: semantic `<table>` with a soft mint header, generous row padding
 * and horizontal scrolling when space is tight (keyboard/touch reachable).
 * Mobile: stacked employee cards so nothing becomes unreadable.
 */
export function EmployeesTable({ rows, pending = false, onAction }) {
  return (
    <>
      {/* Desktop — semantic table with fixed column proportions */}
      <div
        className="hidden overflow-x-auto overflow-y-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
        tabIndex={0}
        aria-label="Employees"
      >
        <div className="relative min-w-[1080px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,var(--accent-soft)_0%,transparent_70%)] opacity-60"
          />
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Employees with name, account status, issued budget, total spent,
              remaining balance, transactions, and date added
            </caption>
            <colgroup>
              {COLUMN_WIDTHS.map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--surface-2)]/80 backdrop-blur-sm">
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={cn(
                      "border-b border-[var(--border)] px-4 py-3.5 type-eyebrow text-[var(--ink-muted)] first:pl-5 last:pr-5",
                      {
                        "text-left": h.align === "left",
                        "text-center": h.align === "center",
                        "text-right": h.align === "right",
                      },
                    )}
                  >
                    {h.srOnly ? (
                      <span className="sr-only">{h.label}</span>
                    ) : (
                      <span className="block truncate" title={h.label}>
                        {h.label}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <EmployeeRow
                  key={e.user_id}
                  employee={e}
                  pending={pending}
                  onAction={onAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile — stacked employee cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((e) => (
          <EmployeeCard
            key={e.user_id}
            employee={e}
            pending={pending}
            onAction={onAction}
          />
        ))}
      </div>
    </>
  );
}

export default EmployeesTable;
