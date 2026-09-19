import { motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import EmployeeActions from "./EmployeeActions";

// Placeholder spend amount used while the employees API has no spend
// aggregate yet. Rows read `employee.total_spent` (or `employee.spent`) as
// soon as the backend sends it and only fall back to this constant when the
// field is missing, so the column never renders an empty cell.
const DEFAULT_TOTAL_SPENT = 1000;

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
 *   spent     → the API's `total_spent` when present, otherwise the
 *               DEFAULT_TOTAL_SPENT placeholder (never `undefined`)
 *   remaining → issued budget minus total spent (negative = over-spent)
 *   share     → remaining balance as a share of the issued budget, clamped to
 *               0–100 exactly like the Budget page utilization bar
 */
function budgetBreakdown(employee) {
  const issued = Math.max(0, Number(employee.issued_budget) || 0);
  // Employees with nothing issued have spent nothing, so the placeholder only
  // applies once a budget has actually been handed to them (otherwise every
  // zero-budget row would read as over budget).
  const fallbackSpent = issued > 0 ? DEFAULT_TOTAL_SPENT : 0;
  const spent = Math.max(
    0,
    Number(employee.total_spent ?? employee.spent ?? fallbackSpent) || 0,
  );
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
 * Presentation-only additions: a slimmer track (h-1.5) with an inset ring,
 * and a success-tinted fill + subtle glow once the bar reaches 100%.
 *
 * Special case: when the issued budget equals the total spent
 * (issued > 0 && remaining === 0) the bar renders at 100% / full-state, because
 * there is literally no remaining balance left — not because there is nothing
 * to track. This keeps the bar honest for a 1000 − 1000 = 0 row without changing
 * the `remaining = issued − spent` formula anywhere.
 */
function RemainingProgress({ remaining, issued, share, label }) {
  // The bar has no issue to track against (issued === 0) → empty track.
  const noIssued = issued <= 0;
  // Fully spent: issued budget equals the total spent, but there is still an
  // issue to measure against.
  const fullySpent = !noIssued && remaining <= 0;
  // What the bar visually shows and reports via ARIA.
  const displayed = noIssued ? 0 : fullySpent ? 100 : Number(share);
  const isFull = displayed >= 100;

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
            : fullySpent
              ? "Budget fully spent"
              : `${displayed}% remaining`
        }
        className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
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
            "h-full rounded-full",
            isFull
              ? "bg-[linear-gradient(90deg,var(--success),var(--success))] shadow-[0_0_6px_1px_var(--success)]"
              : "bg-[linear-gradient(90deg,var(--accent-hero-2),var(--accent-hero))]",
          )}
        />
      </div>
      {isFull && (
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
 * Compact percentage pill shown above the bar. Success tone only at 100% left,
 * danger tone only when the employee overspent, success tone when fully spent
 * (issued === spent) with "Fully spent" label — accent in between.
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
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone,
        className,
      )}
    >
      {overSpent ? (
        <AlertCircle size={10} aria-hidden />
      ) : fullySpent ? (
        <Check size={10} aria-hidden />
      ) : null}
      {fullySpent
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
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-soft),var(--surface-2))] font-display text-sm font-bold tracking-tight text-[var(--accent-strong)] ring-1 ring-inset ring-[var(--accent)]/15 transition-transform duration-200 group-hover:rotate-[-6deg] group-hover:scale-[1.06] group-hover:ring-[var(--accent)]/30">
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
        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(issued)}
        </p>
      </td>

      {/* Total Spent — API `total_spent` when present, else the 1,000 default */}
      <td className="px-4 py-4 text-right align-middle">
        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(spent)}
        </p>
        {overSpent && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--danger)]/12 px-2 py-0.5 text-[11px] font-semibold leading-none text-[var(--danger)]">
            <AlertCircle size={10} aria-hidden />
            Over budget
          </span>
        )}
      </td>

      {/* Remaining — issued budget minus total spent, with the animated bar */}
      <td className="px-4 py-4 align-middle">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
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
            <p className="text-sm font-medium leading-none tabular-nums text-[var(--ink)]">
              {formatDate(employee.created_at)}
            </p>
            <p className="mt-1 text-[12px] leading-none text-[var(--ink-muted)]">
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
