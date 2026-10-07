import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleCheck,
  EllipsisVertical,
  Eye,
  Flag,
  ReceiptText,
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
  toDate,
  startOfDay,
  isSameDay,
  addDays,
} from "../../../../lib/utils";

// Column widths MUST sum to exactly 100% — `table-fixed` distributes any
// leftover/overflow proportionally, so 101% forced a permanent ~11px overflow
// and a always-on horizontal scrollbar inside the scroll container.
const COLUMN_WIDTHS = ["10%", "22%", "15%", "11%", "10%", "12%", "15%", "5%"];

const HEADERS = [
  { label: "Date" },
  { label: "Description" },
  { label: "Employee" },
  { label: "Source of Funds" },
  { label: "Status" },
  { label: "Days" },
  { label: "Amount", align: "right" },
  { label: "Actions", srOnly: true, align: "right" },
];

const EXPENSE_STATUS = {
  paid: { tone: "success", label: "Paid" },
  draft: { tone: "warning", label: "Draft" },
  cancel: { tone: "danger", label: "Cancelled" },
};

const EMPLOYEE_SOURCE_LABEL = "Employee balance";

// Relative-day identifier for the "Days" column — Today / Yesterday /
// Last days by calendar day (local time). Unparseable dates render "—"
// instead of silently falling into Today.
function getDaysLabel(date) {
  if (!toDate(date)) return "—";
  const txDate = startOfDay(toDate(date));
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  if (isSameDay(txDate, today)) return "Today";
  if (isSameDay(txDate, yesterday)) return "Yesterday";
  return "Last days";
}

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
    ...(isEmployeeRow && row?.status === "paid"
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
    // Cancelled rows get their own revoke action — same draft endpoint as
    // "Add to draft" (the server accepts 'paid' and 'cancel'), but labelled
    // for what it undoes. Clicking moves the row back to 'draft' through the
    // existing confirm flow.
    ...(isEmployeeRow && row?.status === "cancel"
      ? [
          {
            key: "restore-draft",
            label: "Restore to draft",
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
            compact ? "h-8 w-8" : "h-8 w-8",
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]",
            compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
          )}
        >
          {initialsOf(name) || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-medium leading-tight text-[var(--ink)]",
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

// High-visibility marker for rows carrying a scanned receipt attachment.
// Rendered next to the description so it reads at a glance.
function ReceiptBadge() {
  return (
    <span
      role="img"
      aria-label="Receipt attached"
      title="Receipt attached"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px]  text-[var(--accent-strong)]"
    >
      {/* <ReceiptText size={12} aria-hidden className="shrink-0" /> */}
      Receipt
    </span>
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
  const hasReceipt = Boolean(row.receiptId || row.imageUrl);
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
        <p className="text-[13px] leading-none text-[var(--ink)]">
          {formatDate(row.timeDate)}
        </p>
        <p className="mt-1.5 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(row.timeDate)}
        </p>
      </td>

      <td className="min-w-0 max-w-0 px-4 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-1.5">
          {row.flagged && (
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
          )}
          <p
            title={row.description}
            className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug text-[var(--ink)]"
          >
            {row.description || "Untitled"}
          </p>
          {hasReceipt && <ReceiptBadge />}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <p
            title={row.category || undefined}
            className="min-w-0 flex-1 truncate text-xs leading-snug text-[var(--ink-muted)]"
          >
            {row.category || "General"}
          </p>
        </div>
      </td>

      <td className="min-w-0 max-w-0 px-4 py-4 align-middle">
        <EmployeeCell
          name={row.employee}
          role={row.employeeRole}
          avatarUrl={row.employeeAvatar}
          size="sm"
        />
      </td>

      <td className="min-w-0 max-w-0 px-4 py-4 align-middle">
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

      <td className="px-4 py-4 align-middle">
        <div className="flex justify-left">
          <p
            className="whitespace-nowrap text-left text-[13px] font-medium leading-none  text-[var(--ink-muted)]"
            title={`${formatDate(row.timeDate)} at ${formatTime(row.timeDate)}`}
          >
            {getDaysLabel(row.timeDate)}
            <span aria-hidden className="mx-1.5 opacity-40">
              ·
            </span>
            <span className="text-[11px]  text-[var(--ink-muted)]">
              {formatTime(row.timeDate)}
            </span>
          </p>
        </div>
      </td>

      <td className="min-w-0 max-w-0 px-4 py-4 text-right align-middle">
        <p className="truncate text-sm font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </p>
        <p
          title={methodLabel(row.method)}
          className="mt-1.5 flex min-w-0 items-center justify-end gap-1.5 text-xs text-[var(--ink-muted)]"
        >
          <MethodIcon method={row.method} className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{methodLabel(row.method)}</span>
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
  const hasReceipt = Boolean(row.receiptId || row.imageUrl);
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
        <span className="shrink-0 text-base font-medium tabular-nums text-[var(--ink)]">
          {formatMoney(row.amount)}
        </span>
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        <p
          title={row.description}
          className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-[var(--ink)]"
        >
          {row.description || "Untitled"}
        </p>
        {hasReceipt && <ReceiptBadge />}
      </div>

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
    {/* Desktop — plain fluid wrapper, NOT a trapped scroll region.
        `overflow-x-auto` + `overflow-y-clip` means: horizontal scroll only
        appears if the 880px floor ever exceeds the card (mid widths); vertical
        wheel / touch can never scroll this box — it always bubbles to the
        page, so the mouse wheel never gets "stuck" on the table. The bar
        itself is hidden (`[scrollbar-width:none]` + hidden webkit scrollbar)
        but keyboard/touch horizontal panning still works when overflow exists.
        No `scrollbar-slim` here on purpose: it sets
        `overscroll-behavior: contain`, which is what trapped the vertical
        wheel inside the table instead of handing it back to the page. */}
    <div
      className="hidden overflow-x-auto overflow-y-clip overscroll-x-auto rounded-3xl [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block [&::-webkit-scrollbar]:hidden"
      tabIndex={0}
      aria-label="Expenses"
    >
      <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card lg:min-w-[880px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
        />

        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Expense records with date, description and category, employee,
            source of funds, status, relative day and time, and amount with
            payment method
          </caption>

          <colgroup>
            {COLUMN_WIDTHS.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>

          <thead>
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
