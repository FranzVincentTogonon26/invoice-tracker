import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  EllipsisVertical,
  HandCoins,
  ReceiptText,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { PAYMENT_METHODS } from "../../../../constants";

/*
 * Unified ledger table for the Expenses page. Each row is either an expense
 * (kind: "expense") or a budget issuance (kind: "issued") - AdminExpenses maps
 * both sources into one shape:
 *   { kind, id, date, timeDate, description, category, amount, employee,
 *     employeeRole, employeeAvatar, method, status }
 *
 * Columns: Date | Description | Employee | Type | Amount | Category | Method |
 * Status | Actions (the burger-dots menu).
 */

// Column proportions — Employee and Description get the most room because
// they carry the primary row context (avatar + name, then the title). Status
// and Category were widened a point each at Employee/Category's expense so the
// status badge and category pill stop truncating. Percentages sum to 100% so
// `table-fixed` never overflows the scroll container (verified against the
// 1120px min-width below).
const COLUMN_WIDTHS = [
  "10%", // Date
  "18%", // Description
  "17%", // Employee
  "12%", // Type
  "10%", // Amount
  "11%", // Category
  "8%", // Method
  "10%", // Status
  "4%", // Actions
];

// One icon per column, rendered in the sticky header as a visual anchor.
// `srOnly` columns (Actions) intentionally carry no icon.
const HEADERS = [
  { label: "Date" },
  { label: "Description" },
  { label: "Employee" },
  { label: "Type" },
  { label: "Amount", align: "right" },
  { label: "Category" },
  { label: "Method" },
  { label: "Status", align: "center" },
  { label: "Actions", srOnly: true, align: "right" },
];

const EXPENSE_STATUS = {
  paid: { tone: "success", label: "Paid" },
  draft: { tone: "warning", label: "Draft" },
  cancel: { tone: "danger", label: "Cancelled" },
};

const TYPE_META = {
  expense: { label: "Expense", tone: "neutral", Icon: ReceiptText },
  issued: { label: "Budget Issued", tone: "accent", Icon: HandCoins },
};

export function ExpenseStatusBadge({ status, className }) {
  const s = EXPENSE_STATUS[status] ?? { tone: "neutral", label: status ?? "-" };
  return (
    <Badge tone={s.tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </Badge>
  );
}

const methodLabel = (method) => {
  const found = PAYMENT_METHODS.find((m) => m.value === method)?.label;
  if (found) return found;
  if (!method) return "-";
  return String(method)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

function TypeBadge({ kind, className }) {
  const meta = TYPE_META[kind] ?? TYPE_META.expense;
  const Icon = meta.Icon;
  return (
    <Badge tone={meta.tone} className={className}>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {meta.label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Row actions: a burger-dots trigger with a portal dropdown menu             */
/* -------------------------------------------------------------------------- */

function RowActions({ row, pending, onDelete, onIssuedAction }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Hooks must run unconditionally - compute the early-exit after them.
  const isFinalized = row.kind === "issued" && row.status === "close";

  // Close on outside click / Escape / scroll / resize while open.
  useEffect(() => {
    if (!open) return undefined;

    const close = () => {
      setOpen(false);
      btnRef.current?.focus();
    };
    const handlePointerDown = (e) => {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      )
        close();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (isFinalized) return null;

  const items =
    row.kind === "expense"
      ? [
          {
            key: "delete",
            label: "Delete expense",
            Icon: Trash2,
            danger: true,
            onSelect: () => onDelete?.(row),
          },
        ]
      : row.status === "cancel"
        ? [
            {
              key: "restore",
              label: "Restore issuance",
              Icon: RefreshCcw,
              danger: false,
              onSelect: () => onIssuedAction?.("restore", row),
            },
          ]
        : [
            {
              key: "cancel",
              label: "Cancel issuance",
              Icon: Ban,
              danger: true,
              onSelect: () => onIssuedAction?.("cancel", row),
            },
          ];

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
      >
        <EllipsisVertical size={16} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Row actions"
            style={{ top: position.top, right: position.right }}
            className="fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {items.map(({ key, label, Icon, danger, onSelect }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40",
                  danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
                )}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// Avatar with an initials fallback (users.avatar_url is usually NULL).
function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function EmployeeCell({ name, role, avatarUrl, size = "md" }) {
  // "sm" fits narrow ledger columns (Expenses table); "md" is the original
  // Budget Issued Transaction sizing.
  const compact = size === "sm";
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className={cn(
            "shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]",
            compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
          )}
        >
          {initialsOf(name) || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold leading-tight text-[var(--ink)]",
            compact ? "text-sm" : "text-base",
          )}
        >
          {name || "Unknown"}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate capitalize text-[var(--ink-muted)]",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {/* users.role is CHECK-constrained to 'admin' | 'employee' */}
          {role || "—"}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ledger row + mobile card                                                   */
/* -------------------------------------------------------------------------- */

function LedgerRow({
  row,
  removePending,
  issuedPending,
  onDelete,
  onIssuedAction,
}) {
  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]">
      <td className="relative px-4 py-3.5 pl-5 align-middle">
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--accent-strong)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
        <p className="text-sm leading-none tabular-nums text-[var(--ink)]">
          {formatDate(row.date)}
        </p>
        <p className="mt-1 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(row.timeDate)}
        </p>
      </td>

      <td className="px-4 py-3.5 align-middle">
        <p
          title={row.description}
          className="truncate text-sm font-semibold leading-snug text-[var(--ink)]"
        >
          {row.description || "Untitled"}
        </p>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <EmployeeCell
          name={row.employee}
          role={row.employeeRole}
          avatarUrl={row.employeeAvatar}
          size="sm"
        />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <TypeBadge kind={row.kind} className="max-w-full" />
      </td>
      <td className="px-4 py-3.5 text-right align-middle">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </span>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <Badge tone="neutral" className="max-w-full">
          <span
            title={row.category}
            className="block truncate text-sm text-[var(--ink-muted)] text-[12px]"
          >
            {row.category || "-"}
          </span>
        </Badge>
      </td>

      <td className="px-4 py-3.5 align-middle">
        <Badge tone="neutral" className="max-w-full">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <MethodIcon method={row.method} />
            <span className="truncate">{methodLabel(row.method)}</span>
          </span>
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-center align-middle">
        {row.kind === "issued" ? (
          <StatusBadge status={row.status} />
        ) : (
          <ExpenseStatusBadge status={row.status} />
        )}
      </td>
      <td className="px-4 py-3.5 pr-5 text-right align-middle">
        <div className="flex justify-end">
          <RowActions
            row={row}
            pending={removePending || issuedPending}
            onDelete={onDelete}
            onIssuedAction={onIssuedAction}
          />
        </div>
      </td>
    </tr>
  );
}

function LedgerCard({
  row,
  removePending,
  issuedPending,
  onDelete,
  onIssuedAction,
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <div className="flex items-center justify-between gap-3">
        <TypeBadge kind={row.kind} className="max-w-full" />
        {row.kind === "issued" ? (
          <StatusBadge status={row.status} />
        ) : (
          <ExpenseStatusBadge status={row.status} />
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug text-[var(--ink)]">
            {row.description || "Untitled"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
            {[row.category, row.employee].filter(Boolean).join(" - ")}
          </p>
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <MethodIcon method={row.method} />
          <span className="truncate">{methodLabel(row.method)}</span>
        </span>
        <span className="shrink-0 tabular-nums">{formatDate(row.date)}</span>
        <span className="ml-auto shrink-0">
          <RowActions
            row={row}
            pending={removePending || issuedPending}
            onDelete={onDelete}
            onIssuedAction={onIssuedAction}
          />
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

const ExpensesTable = ({
  rows,
  removePending = false,
  issuedPending = false,
  onDelete,
  onIssuedAction,
}) => (
  <>
    <div
      className="hidden overflow-x-auto rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
      tabIndex={0}
      aria-label="Expenses and budget issuances"
    >
      <div className="relative min-w-[1120px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
        />
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Unified ledger of expenses and budget issuances with date,
            description, employee, type, amount, category, payment method, and
            status
          </caption>
          <colgroup>
            {COLUMN_WIDTHS.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1]">
            {/* Soft mint header: slightly heavier backdrop so rows scrolling
                underneath stay legible, an accent-tinted rule to echo the
                hairline gradient on the card's top edge, and a small icon per
                column as a scan anchor. Alignment matches each body cell
                (Amount right, Status center, Actions screen-reader only). */}
            <tr className="bg-[var(--surface-2)]/90 backdrop-blur">
              {HEADERS.map((h) => (
                <th
                  key={h.label}
                  scope="col"
                  className={cn(
                    "border-b border-[var(--accent)]/25 px-4 py-4 type-eyebrow text-[var(--ink-muted)] first:pl-5 last:pr-5",
                    {
                      "text-left": h.align === "left",
                      "text-center": h.align === "center",
                      "text-right": h.align === "right",
                    },
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      h.srOnly ? "sr-only" : "whitespace-nowrap",
                      { "justify-center": h.align === "center" },
                      { "justify-end": h.align === "right" },
                    )}
                  >
                    {h.Icon && (
                      <h.Icon
                        size={13}
                        strokeWidth={2.25}
                        aria-hidden
                        className="shrink-0 text-[var(--accent-strong)] opacity-70"
                      />
                    )}
                    {h.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LedgerRow
                key={row.id}
                row={row}
                removePending={removePending}
                issuedPending={issuedPending}
                onDelete={onDelete}
                onIssuedAction={onIssuedAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <LedgerCard
          key={row.id}
          row={row}
          removePending={removePending}
          issuedPending={issuedPending}
          onDelete={onDelete}
          onIssuedAction={onIssuedAction}
        />
      ))}
    </div>
  </>
);

export default ExpensesTable;
