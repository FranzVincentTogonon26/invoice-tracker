import { Badge } from "../../../ui/Badge";
import { cn, formatDate, formatMoney } from "../../../../lib/utils";
import EmployeeActions from "./EmployeeActions";

// Column proportions — Employee gets the most space because it anchors the
// row. Percentages sum to 100% so `table-fixed` never overflows the scroll
// container (sizing verified against the 960px min-width).
const COLUMN_WIDTHS = ["24%", "10%", "12%", "18%", "16%", "20%"];

const HEADERS = [
  { label: "Employee" },
  { label: "Role", align: "center" },
  { label: "Status", align: "center" },
  { label: "Issued Budget", align: "right" },
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

/** Avatar circle with the employee's initial, name and email below it. */
function EmployeeCell({ employee }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[13px] font-bold text-[var(--accent-strong)] ring-2 ring-[var(--accent)]/10">
        {employee.name?.trim()?.[0]?.toUpperCase() || "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-snug text-[var(--ink)]">
          {employee.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--ink-muted)]">
          {employee.email}
        </p>
      </div>
    </div>
  );
}

/** Desktop table row. */
function EmployeeRow({ employee, pending, onAction }) {
  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]">
      <td className="px-4 py-3.5 pl-5 align-middle">
        <EmployeeCell employee={employee} />
      </td>

      {/* Role */}
      <td className="px-4 py-3.5 text-center align-middle">
        <Badge tone="neutral">Employee</Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5 text-center align-middle">
        <EmployeeStatusBadge status={employee.status} />
      </td>

      {/* Issued Budget */}
      <td className="px-4 py-3.5 text-right align-middle">
        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(employee.issued_budget)}
        </p>
        {Number(employee.issued_references) > 0 && (
          <p className="mt-1 text-[10px] leading-none text-[var(--ink-muted)]">
            {employee.issued_references}{" "}
            {employee.issued_references === 1 ? "reference" : "references"}
          </p>
        )}
      </td>

      {/* Date Added */}
      <td className="px-4 py-3.5 align-middle">
        {employee.created_at ? (
          <p className="text-xs leading-none tabular-nums text-[var(--ink)]">
            {formatDate(employee.created_at)}
          </p>
        ) : (
          <p className="text-xs leading-none text-[var(--ink-muted)]">—</p>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 pr-5 text-right align-middle">
        <EmployeeActions
          employee={employee}
          pending={pending}
          onAction={onAction}
        />
      </td>
    </tr>
  );
}

/** Mobile employee card — every column stays readable in a stacked layout. */
function EmployeeCard({ employee, pending, onAction }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div className="flex items-start justify-between gap-3">
        <EmployeeCell employee={employee} />
        <EmployeeStatusBadge status={employee.status} className="shrink-0" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(employee.issued_budget)}
        </span>
        <span className="text-xs text-[var(--ink-muted)]">
          {employee.created_at ? formatDate(employee.created_at) : "—"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3">
        <Badge tone="neutral">Employee</Badge>
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
        <div className="relative min-w-[960px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          {/* Accent hairline running along the top edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
          />
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Employees with name, role, account status, issued budget, and
              date added
            </caption>
            <colgroup>
              {COLUMN_WIDTHS.map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-[var(--surface-2)]/60">
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={cn(
                      "border-b border-[var(--border)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] first:pl-5 last:pr-5",
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
                      <span className="whitespace-nowrap">{h.label}</span>
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