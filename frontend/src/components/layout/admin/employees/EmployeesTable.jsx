import { motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import EmployeeActions from "./EmployeeActions";
import { budgetBreakdown } from "../../../../constants/index";

const COLUMN_WIDTHS = [
  "24%", // Employee
  "11%", // Status
  "11%", // Issued Budget
  "10%", // Total Spent
  "17%", // Remaining (+ pill + progress bar)
  "8%", // Transactions
  "11%", // Date Added
  "8%", // Actions
];

const HEADERS = [
  { label: "Employee" },
  { label: "Status", align: "center" },
  { label: "Issued Budget", align: "right" },
  { label: "Total Spent", align: "right" },
  { label: "Remaining" },
  { label: "Transactions", align: "center" },
  { label: "Date Added" },
  { label: "Actions", srOnly: true, align: "center" },
];

// Account status colors — `pending` intentionally uses the warning tone here
// (a queued, actionable state) while active/inactive re-use the global map.
const STATUS_TONES = {
  active: "success",
  pending: "warning",
  inactive: "danger",
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

// The issued / spent / remaining figures come from `budgetBreakdown`
// (./employeeBudget) — the shared helper the profile modal uses too, so the
// table and the modal can never disagree.

export function RemainingProgress({
  remaining,
  funded,
  spentShare,
  overSpent = false,
  label,
}) {
  // No funding behind the pool (nothing issued, no abono, no transfers
  // received) → empty track.
  const noFunding = funded <= 0;
  // Spent more than the pool holds → danger tier (no success check).
  const isOver = !noFunding && overSpent;
  // Pool exactly exhausted, but there is still funding to measure against →
  // success tier.
  const fullySpent = !noFunding && !isOver && remaining <= 0;

  // Fill + announcement follow `spentShare` from the shared breakdown, so the
  // bar always agrees exactly with formatMoney(remaining).
  const spentPct = noFunding ? 0 : spentShare;

  return (
    <div className="flex items-center gap-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={spentPct}
        aria-label={label}
        aria-valuetext={
          noFunding
            ? "No issued budget tracked"
            : isOver
              ? "Budget exceeded"
              : fullySpent
                ? "Budget fully spent"
                : `${spentPct}% spent`
        }
        className="remaining-track h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${spentPct}%` }}
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

export function SharePill({
  remaining,
  funded,
  spentShare,
  overSpent,
  className,
}) {
  const fullySpent = funded > 0 && remaining <= 0;
  // Exact spent share from the shared breakdown (2 decimals, e.g. 99.05) —
  // the pill prints the same figure the bar fills, both derived from
  // formatMoney(remaining).
  const spentPct = spentShare ?? 0;

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
          : `${spentPct}% spent`}
    </span>
  );
}

/** Employee identity cell — stored photo when the account has one, initial
    tile otherwise. */
function EmployeeCell({ employee }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EmployeeAvatar
        name={employee.name}
        avatarUrl={employee.avatar_url}
        className="h-9 w-9 rounded-full text-sm ring-1 ring-inset ring-[var(--accent)]/15"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold leading-snug tracking-tight text-[var(--ink)] transition-colors duration-150 group-hover:text-[var(--accent-strong)]">
          {employee.name}
        </p>
        <p className="mt-0.5 truncate text-xs leading-tight text-[var(--ink-muted)]">
          {employee.email}
        </p>
      </div>
    </div>
  );
}

/** Desktop table row. */
function EmployeeRow({ employee, pending, onAction }) {
  const {
    issued,
    spent,
    remaining,
    received,
    abono,
    sent,
    funded,
    spentShare,
  } = budgetBreakdown(employee);
  // Spending more than the issued budget flips the remaining amount red — the
  // same signal the Budget page uses for over-issued references.
  const overSpent = remaining < 0;

  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40 hover:bg-[var(--accent)]/[0.04]">
      <td className="px-4 py-3 pl-5 align-middle">
        <EmployeeCell employee={employee} />
      </td>
      {/* Status */}
      <td className="px-3 py-3.5 text-center align-middle">
        <EmployeeStatusBadge status={employee.status} />
      </td>
      <td className="px-3 py-3.5 text-right align-middle">
        <div className="space-y-1">
          {received > 0 && (
            <p
              className="text-xs font-semibold tabular-nums text-[var(--accent-strong)]"
              title={`${formatMoney(received)} received from budget transfers`}
            >
              + {formatMoney(received)}
            </p>
          )}
          {abono > 0 && (
            <p
              className="text-xs font-semibold tabular-nums text-[var(--warning)]"
              title={`${formatMoney(abono)} abono held`}
            >
              + {formatMoney(abono)}
            </p>
          )}
          <p className="font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(issued)}
          </p>
        </div>
      </td>

      <td className="px-3 py-3.5 text-right align-middle">
        <div className="space-y-1">
          {sent > 0 && (
            <p
              className="text-xs font-semibold tabular-nums text-[var(--danger)]"
              title={`${formatMoney(sent)} sent via budget transfers`}
            >
              - {formatMoney(sent)}
            </p>
          )}
          <p className="font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(spent)}
          </p>
        </div>
      </td>

      <td className="px-3 py-3.5 align-middle">
        <div className="px-3 py-2 ">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "font-display text-[15px] font-semibold tabular-nums",
                overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
              )}
            >
              {formatMoney(remaining)}
            </p>
            <SharePill
              remaining={remaining}
              funded={funded}
              spentShare={spentShare}
              overSpent={overSpent}
            />
          </div>
          <div className="mt-2">
            <RemainingProgress
              remaining={remaining}
              funded={funded}
              spentShare={spentShare}
              overSpent={overSpent}
              label={`Remaining balance for ${employee.name ?? "employee"}`}
            />
          </div>
        </div>
      </td>

      <td className="px-3 py-3.5 text-center align-middle">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--surface-2)] px-2 text-xs font-semibold tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--border)]">
          {Number(employee.issued_references) || 0}
        </span>
      </td>

      {/* Date Added */}
      <td className="px-3 py-3.5 align-middle">
        {employee.created_at ? (
          <div>
            <p className="whitespace-nowrap text-[13px] font-medium leading-none text-[var(--ink)]">
              {formatDate(employee.created_at)}
            </p>
            <p className="mt-1 text-xs leading-none  text-[var(--ink-muted)]">
              {formatTime(employee.created_at)}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-none text-[var(--ink-muted)]">—</p>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3.5 pr-4 text-center align-middle">
        <div className="flex justify-center">
          <EmployeeActions
            employee={employee}
            pending={pending}
            onAction={onAction}
          />
        </div>
      </td>
    </tr>
  );
}

/** Label + value pair used in the mobile card's budget strip. */
function CardMetric({ label, value, tone, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="type-eyebrow text-[var(--ink-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-display text-[15px] font-semibold tabular-nums",
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
  const { issued, spent, remaining, received, abono, funded, spentShare } =
    budgetBreakdown(employee);
  const overSpent = remaining < 0;
  const references = Number(employee.issued_references) || 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover",
        overSpent && "border-[var(--danger)]/40",
      )}
    >
      {/* Top glow accent — echoes the desktop table's header highlight. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <div className="flex items-center gap-3">
        <EmployeeCell employee={employee} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <EmployeeStatusBadge status={employee.status} />
          <EmployeeActions
            employee={employee}
            pending={pending}
            onAction={onAction}
          />
        </div>
      </div>

      {/* Budget strip — issued / spent / remaining, mirroring the table */}
      <div className="mt-3.5 grid grid-cols-3 gap-3 rounded-xl bg-[var(--surface-2)]/60 p-3 ring-1 ring-inset ring-[var(--border)]">
        <CardMetric label="Issued" value={formatMoney(issued)} />
        <CardMetric
          label="Spent"
          value={formatMoney(spent)}
          className="border-l border-[var(--border)] pl-3"
        />
        <CardMetric
          label="Remaining"
          value={formatMoney(remaining)}
          tone={overSpent ? "danger" : undefined}
          className="border-l border-[var(--border)] pl-3"
        />
        {/* Same "+ received" figure as the table row's Issued Budget cell —
            only rendered when the employee actually received a transfer. */}
        {received > 0 && (
          <p className="col-span-3 text-xs font-semibold tabular-nums text-[var(--accent-strong)]">
            + {formatMoney(received)} received budget
          </p>
        )}
        {/* Same "+ abono" figure as the table row — open abono the employee
            still holds, warning tone like the Overview's Abono stat. */}
        {abono > 0 && (
          <p className="col-span-3 text-xs font-semibold tabular-nums text-[var(--warning)]">
            + {formatMoney(abono)} abono held
          </p>
        )}
      </div>

      {/* Remaining-balance bar — the same animated component as the table row */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="type-eyebrow text-[var(--ink-muted)]">
            Remaining balance
          </p>
          <SharePill
            remaining={remaining}
            funded={funded}
            spentShare={spentShare}
            overSpent={overSpent}
          />
        </div>
        <RemainingProgress
          remaining={remaining}
          funded={funded}
          spentShare={spentShare}
          overSpent={overSpent}
          label={`Remaining balance for ${employee.name ?? "employee"}`}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--border)] pt-3">
        <span className="text-xs tabular-nums text-[var(--ink-muted)]">
          {employee.created_at
            ? `${formatDate(employee.created_at)} · ${formatTime(employee.created_at)}`
            : "—"}
        </span>
        <Badge tone="neutral">
          {references} {references === 1 ? "reference" : "references"}
        </Badge>
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
                      "border-b border-[var(--border)] px-3 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-5 last:pr-4",
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
