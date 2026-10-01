import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleCheck,
  EllipsisVertical,
  Eye,
  RotateCcw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { MethodIcon } from "../../../ui/Select";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";

const COLUMN_WIDTHS = ["11%", "27%", "19%", "14%", "14%", "24%", "5%"];

const HEADERS = [
  { label: "Date" },
  { label: "Description" },
  { label: "Employee" },
  { label: "Source of Funds" },
  { label: "Status" },
  { label: "Amount", align: "right" },
  { label: "Actions", srOnly: true, align: "right" },
];

const EXPENSE_STATUS = {
  paid: { tone: "success", label: "Paid" },
  draft: { tone: "warning", label: "Draft" },
  cancel: { tone: "danger", label: "Cancelled" },
};

const EMPLOYEE_SOURCE_LABEL = "Employee balance";

export function ExpenseStatusBadge({ status, className }) {
  const s = EXPENSE_STATUS[status] ?? {
    tone: "neutral",
    label: status ?? "-",
  };
  return (
    <Badge tone={s.tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </Badge>
  );
}

export function FlaggedBadge({ className }) {
  return (
    <Badge
      tone="danger"
      className={className}
      title="Flagged for review — this record may need verification"
    >
      {/* <TriangleAlert size={12} aria-hidden className="shrink-0" /> */}
      Red Flag
    </Badge>
  );
}

function SourceFundsBadge({ source, tone }) {
  if (!source) {
    return (
      <span
        className="text-xs text-[var(--ink-muted)]"
        title="No source of funds recorded"
      >
        —
      </span>
    );
  }
  return (
    <Badge
      tone={tone ?? (source === "No source of funds" ? "neutral" : "accent")}
      className="max-w-full"
      title={source}
    >
      <Wallet size={12} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{source}</span>
    </Badge>
  );
}

function RowActions({
  row,
  pending,
  onView,
  onDelete,
  onAddToDraft,
  onRemoveFromDraft,
  onCancelExpense,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

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
    window.addEventListener("scroll", close, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Cancelled employee rows keep the full lifecycle: View, Add to draft
  // (reactivate as a draft) and Delete. Paid employee rows offer View + Add
  // to draft (soft-delete path, so no hard Delete); drafts offer View +
  // Remove from draft + Cancel expense + Delete. Admin-authored rows never
  // enter the draft lifecycle, so they offer View + Delete only.
  // `group` clusters the dropdown: viewing, status moves, then the
  // destructive action — rendered with a separator between clusters.
  const isEmployeeRow = row?.employeeRole === "employee";
  const items = [
    {
      key: "view",
      label: "View expense",
      Icon: Eye,
      danger: false,
      group: "view",
      onSelect: () => onView?.(row),
    },
    ...(isEmployeeRow &&
    (row?.status === "paid" || row?.status === "cancel")
      ? [
          {
            key: "draft",
            label: "Add to draft",
            Icon: RotateCcw,
            danger: false,
            group: "lifecycle",
            onSelect: () => onAddToDraft?.(row),
          },
        ]
      : []),
    ...(isEmployeeRow && row?.status === "draft"
      ? [
          {
            key: "restore",
            label: "Remove from draft",
            Icon: CircleCheck,
            danger: false,
            group: "lifecycle",
            onSelect: () => onRemoveFromDraft?.(row),
          },
          {
            key: "cancel",
            label: "Cancel expense",
            Icon: XCircle,
            danger: false,
            group: "lifecycle",
            onSelect: () => onCancelExpense?.(row),
          },
        ]
      : []),
    ...(isEmployeeRow && row?.status === "paid"
      ? []
      : [
          {
            key: "delete",
            label: "Delete expense",
            Icon: Trash2,
            danger: true,
            group: "danger",
            onSelect: () => onDelete?.(row),
          },
        ]),
  ];

  // Preserve group order (view → lifecycle → danger), dropping empty clusters
  // so no stray separator renders.
  const sections = ["view", "lifecycle", "danger"]
    .map((group) => items.filter((item) => item.group === group))
    .filter((section) => section.length > 0);

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
            {sections.map((section, sectionIndex) => (
              <div key={section[0].group}>
                {sectionIndex > 0 && (
                  <div
                    role="separator"
                    aria-hidden
                    className="mx-3 border-t border-[var(--border)]"
                  />
                )}
                {section.map(({ key, label, Icon, danger, onSelect }) => (
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
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function EmployeeCell({ name, role, avatarUrl, size = "md" }) {
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
            compact ? "text-[13px]" : "text-base",
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
          {role || "—"}
        </p>
      </div>
    </div>
  );
}

function LedgerRow({
  row,
  pending,
  onView,
  onDelete,
  onAddToDraft,
  onRemoveFromDraft,
  onCancelExpense,
}) {
  return (
    <tr
      className={cn(
        "group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]",
        row.flagged && "bg-[var(--danger)]/[0.03]",
      )}
    >
      <td className="relative px-4 py-4 pl-5 align-middle">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-3 left-0 w-0.5 rounded-full transition-opacity duration-150",
            row.flagged
              ? "bg-[var(--danger)] opacity-100"
              : "bg-[var(--accent-strong)] opacity-0 group-hover:opacity-100",
          )}
        />
        <p className="text-sm leading-none tabular-nums text-[var(--ink)]">
          {formatDate(row.timeDate)}
        </p>
        <p className="mt-1.5 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(row.timeDate)}
        </p>
      </td>

      <td className="px-4 py-4 align-middle">
        <p
          title={row.description}
          className="truncate text-sm font-semibold leading-snug text-[var(--ink)]"
        >
          {row.description || "Untitled"}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p
            title={row.category || undefined}
            className="min-w-0 truncate text-xs leading-snug text-[var(--ink-muted)]"
          >
            {row.category || "—"}
          </p>
          {row.flagged && <FlaggedBadge className="shrink-0" />}
        </div>
      </td>

      <td className="px-4 py-4 align-middle">
        <EmployeeCell
          name={row.employee}
          role={row.employeeRole}
          avatarUrl={row.employeeAvatar}
          size="sm"
        />
      </td>

      <td className="px-4 py-4 align-middle">
        <SourceFundsBadge
          source={
            row.employeeRole === "employee"
              ? EMPLOYEE_SOURCE_LABEL
              : row.sourceOfFunds
          }
          tone={row.employeeRole === "employee" ? "neutral" : undefined}
        />
      </td>

      <td className="px-4 py-4 align-middle">
        <ExpenseStatusBadge status={row.status} />
      </td>

      <td className="px-4 py-4 text-right align-middle">
        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </p>
        <p
          title={methodLabel(row.method)}
          className="mt-1.5 flex items-center justify-end gap-1.5 text-xs text-[var(--ink-muted)]"
        >
          <MethodIcon method={row.method} className="h-3.5 w-3.5" />
          <span className="truncate">{methodLabel(row.method)}</span>
        </p>
      </td>

      <td className="px-4 py-4 pr-5 text-right align-middle">
        <div className="flex justify-end">
          <RowActions
            row={row}
            pending={pending}
            onView={onView}
            onDelete={onDelete}
            onAddToDraft={onAddToDraft}
            onRemoveFromDraft={onRemoveFromDraft}
            onCancelExpense={onCancelExpense}
          />
        </div>
      </td>
    </tr>
  );
}

function LedgerCard({
  row,
  pending,
  onView,
  onDelete,
  onAddToDraft,
  onRemoveFromDraft,
  onCancelExpense,
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover",
        row.flagged && "border-[var(--danger)]/60 bg-[var(--danger)]/[0.06]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />

      <div className="flex items-start justify-end">
        <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </span>
      </div>

      <p
        title={row.description}
        className="mt-2 truncate text-sm font-semibold leading-snug text-[var(--ink)]"
      >
        {row.description || "Untitled"}
      </p>

      <p className="mt-0.5 truncate text-xs leading-snug text-[var(--ink-muted)]">
        {[row.category, row.employee].filter(Boolean).join(" | ") || "—"}{" "}
        {" | "}
        {row.sourceOfFunds}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--border)] pt-2.5">
        <ExpenseStatusBadge status={row.status} />

        <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <MethodIcon method={row.method} className="h-3.5 w-3.5" />
          <span className="truncate">{methodLabel(row.method)}</span>
        </span>

        <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
          {formatDate(row.timeDate)}
        </span>

        <RowActions
          row={row}
          pending={pending}
          onView={onView}
          onDelete={onDelete}
          onAddToDraft={onAddToDraft}
          onRemoveFromDraft={onRemoveFromDraft}
          onCancelExpense={onCancelExpense}
        />
      </div>
    </div>
  );
}

const ExpensesTable = ({
  rows,
  pending = false,
  onView,
  onDelete,
  onAddToDraft,
  onRemoveFromDraft,
  onCancelExpense,
}) => (
  <>
    <div
      className="hidden overflow-x-auto rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
      tabIndex={0}
      aria-label="Expenses"
    >
      <div className="relative min-w-[1020px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
        />

        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Expense records with date, description and category, employee,
            source of funds, status, and amount with payment method
          </caption>

          <colgroup>
            {COLUMN_WIDTHS.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-[1]">
            <tr className="bg-[var(--surface-2)]/90 backdrop-blur">
              {HEADERS.map((h) => (
                <th
                  key={h.label}
                  scope="col"
                  className={cn(
                    "border-b border-[var(--accent)]/30 px-4 pb-4 pt-6 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom first:pl-5 last:pr-5",
                    {
                      "text-left": h.align === "left",
                      "text-center": h.align === "center",
                      "text-right": h.align === "right",
                    },
                  )}
                >
                  <span className={h.srOnly ? "sr-only" : "whitespace-nowrap"}>
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
                pending={pending}
                onView={onView}
                onDelete={onDelete}
                onAddToDraft={onAddToDraft}
                onRemoveFromDraft={onRemoveFromDraft}
                onCancelExpense={onCancelExpense}
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
          pending={pending}
          onView={onView}
          onDelete={onDelete}
          onAddToDraft={onAddToDraft}
          onRemoveFromDraft={onRemoveFromDraft}
          onCancelExpense={onCancelExpense}
        />
      ))}
    </div>
  </>
);

export default ExpensesTable;
