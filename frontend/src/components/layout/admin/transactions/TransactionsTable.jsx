import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  Ban,
  CircleCheck,
  EllipsisVertical,
  Eye,
  Flag,
  HandCoins,
  Plus,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge, StatusBadge } from "../../../ui/Badge";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";

// Every kind the unified ledger carries: its badge tone, label and icon.
export const TRANSACTION_KIND_META = {
  budget: { tone: "neutral", label: "Budget Given", Icon: Plus },
  issued: { tone: "accent", label: "Budget Issued", Icon: HandCoins },
  expense: { tone: "warning", label: "Expense", Icon: ReceiptText },
  abono: { tone: "success", label: "Abono", Icon: Wallet },
  transfer_sent: {
    tone: "danger",
    label: "Transfer Sent",
    Icon: ArrowLeftRight,
  },
  transfer_received: {
    tone: "success",
    label: "Transfer Received",
    Icon: ArrowLeftRight,
  },
};

export function TransactionKindBadge({ kind, className }) {
  const meta = TRANSACTION_KIND_META[kind] ?? {
    tone: "neutral",
    label: kind ?? "—",
    Icon: ReceiptText,
  };
  const { Icon } = meta;
  return (
    <Badge
      tone={meta.tone}
      className={cn("max-w-full", className)}
      title={meta.label}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{meta.label}</span>
    </Badge>
  );
}

function SourceFundsBadge({ source }) {
  if (!source || source === "No source of funds") {
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
    <Badge tone="accent" className="max-w-full" title={source}>
      <Wallet size={12} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{source}</span>
    </Badge>
  );
}

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function PersonCell({ name, role, avatarUrl, fallback = "System" }) {
  return (
    <div className="flex items-center gap-2.5">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-strong)]"
        >
          {initialsOf(name || fallback)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--ink)]">
          {name || fallback}
        </p>
        {role && (
          <p className="mt-0.5 truncate text-xs capitalize text-[var(--ink-muted)]">
            {role}
          </p>
        )}
      </div>
    </div>
  );
}

// Action menu per ledger kind
function actionsForRow(row) {
  const items = [
    {
      key: "view",
      label: "View details",
      Icon: Eye,
      danger: false,
      group: "view",
    },
  ];

  if (row.kind === "budget") {
    items.push(
      row.status === "cancelled"
        ? {
            key: "restore-budget",
            label: "Restore transaction",
            Icon: RefreshCcw,
            danger: false,
            group: "lifecycle",
          }
        : {
            key: "cancel-budget",
            label: "Cancel transaction",
            Icon: Ban,
            danger: true,
            group: "danger",
          },
    );
  }

  if (row.kind === "issued") {
    items.push(
      row.status === "cancel"
        ? {
            key: "restore-issued",
            label: "Restore issuance",
            Icon: RefreshCcw,
            danger: false,
            group: "lifecycle",
          }
        : {
            key: "cancel-issued",
            label: "Cancel issuance",
            Icon: Ban,
            danger: true,
            group: "danger",
          },
    );
  }

  if (row.kind === "expense") {
    const isEmployeeRow = row.employeeRole === "employee";
    if (isEmployeeRow && row.status === "paid") {
      items.push({
        key: "expense-draft",
        label: "Add to draft",
        Icon: RotateCcw,
        danger: false,
        group: "lifecycle",
      });
    }
    if (isEmployeeRow && row.status === "cancel") {
      items.push({
        key: "expense-draft",
        label: "Restore to draft",
        Icon: RotateCcw,
        danger: false,
        group: "lifecycle",
      });
    }
    if (isEmployeeRow && row.status === "draft") {
      items.push(
        {
          key: "expense-restore",
          label: "Remove from draft",
          Icon: CircleCheck,
          danger: false,
          group: "lifecycle",
        },
        {
          key: "expense-cancel",
          label: "Cancel expense",
          Icon: XCircle,
          danger: false,
          group: "lifecycle",
        },
      );
    }
    if (!(isEmployeeRow && row.status === "paid")) {
      items.push({
        key: "delete-expense",
        label: "Delete expense",
        Icon: Trash2,
        danger: true,
        group: "danger",
      });
    }
  }

  if (row.kind === "abono") {
    items.push({
      key: "delete-abono",
      label: "Delete abono",
      Icon: Trash2,
      danger: true,
      group: "danger",
    });
  }

  if (
    (row.kind === "transfer_sent" || row.kind === "transfer_received") &&
    row.status === "success"
  ) {
    items.push({
      key: "cancel-transfer",
      label: "Cancel transfer",
      Icon: Ban,
      danger: true,
      group: "danger",
    });
  }

  return items;
}

function RowActions({ row, pending, onAction }) {
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

  const items = actionsForRow(row);

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
            className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
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
                {section.map(({ key, label, Icon, danger }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={() => {
                      setOpen(false);
                      onAction?.(key, row);
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

function LedgerRow({ row, pending, onAction }) {
  const isIn = row.direction === "in";
  const isOut = row.direction === "out";
  const isVoid = row.direction === "void";
  // Transfer legs carry system-generated memo text in `notes` — never show it
  // inline; the counterparty line already explains the movement.
  const showNotes =
    Boolean(row.notes) &&
    row.kind !== "transfer_sent" &&
    row.kind !== "transfer_received";

  return (
    <tr className="group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]">
      {/* 1. Date */}
      <td className="relative px-4 py-3.5 pl-5 align-middle">
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--accent-strong)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
        <p className="text-[13px] font-medium leading-none text-[var(--ink)]">
          {formatDate(row.date)}
        </p>
        <p className="mt-1 text-xs leading-none tabular-nums text-[var(--ink-muted)]">
          {formatTime(row.date)}
        </p>
      </td>

      {/* 2. Description */}
      <td className="min-w-0 max-w-0 px-4 py-3.5 align-middle">
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
            className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-[var(--ink)]"
          >
            {row.description || "Untitled"}
          </p>
        </div>
        {row.categoryName || row.flagged ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {row.categoryName && (
              <span className="inline-flex items-center rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--ink)]">
                {row.categoryName}
              </span>
            )}
          </div>
        ) : null}
        {showNotes && (
          <p
            title={row.notes}
            className="mt-1.5 line-clamp-2 break-words border-l-2 border-[var(--accent)]/30 pl-2 text-[11px] italic leading-relaxed text-[var(--ink-muted)]"
          >
            {row.notes}
          </p>
        )}
      </td>

      {/* 3. Type */}
      <td className="min-w-0 max-w-0 px-4 py-3.5 align-middle">
        <TransactionKindBadge kind={row.kind} />
      </td>

      {/* 4. Method */}
      <td className="min-w-0 max-w-0 px-4 py-3.5 align-middle">
        <Badge
          tone="neutral"
          title={row.method ? methodLabel(row.method) : "Cash"}
          className="max-w-full"
        >
          <span className="min-w-0 truncate">
            {row.method ? methodLabel(row.method) : "Cash"}
          </span>
        </Badge>
      </td>

      {/* 5. Account / Person */}
      <td className="px-4 py-3.5 align-middle">
        {row.employeeId || row.employeeName ? (
          <div>
            <PersonCell
              name={row.employeeName}
              role={row.employeeRole}
              avatarUrl={row.employeeAvatar}
            />
            {row.counterpartyName && (
              <p className="mt-1 flex items-center gap-1 pl-10 text-xs text-[var(--ink-muted)]">
                <ArrowLeftRight
                  size={11}
                  className="shrink-0 text-[var(--accent)]"
                />
                <span className="truncate">
                  {row.kind === "transfer_sent" ? "To" : "From"}:{" "}
                  <strong className="font-medium text-[var(--ink)]">
                    {row.counterpartyName}
                  </strong>
                  {row.counterpartyRole ? ` (${row.counterpartyRole})` : ""}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--ink-muted)]"
            >
              SYS
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-[var(--ink)]">
                System
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                {row.approvedBy ? `By ${row.approvedBy}` : "Allocation"}
              </p>
            </div>
          </div>
        )}
      </td>

      {/* 6. Reference */}
      <td className="px-4 py-3.5 align-middle">
        <SourceFundsBadge source={row.referenceLabel} />
      </td>

      {/* 7. Status */}
      <td className="px-3 py-3.5 align-middle">
        <StatusBadge status={row.status} />
        {row.expenseDate && (
          <p className="mt-1 text-[11px] tabular-nums text-[var(--ink-muted)]">
            Exp: {formatDate(row.expenseDate)}
          </p>
        )}
        {row.dateSettled && (
          <p className="mt-1 text-[11px] tabular-nums text-[var(--ink-muted)]">
            Settled: {formatDate(row.dateSettled)}
          </p>
        )}
      </td>

      {/* 8. Amount & Flow */}
      <td className="px-4 py-3.5 text-right align-middle">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isIn && "text-[var(--success)]",
            isOut && "text-[var(--danger)]",
            isVoid &&
              "text-[var(--ink-muted)] line-through decoration-[var(--border)]",
          )}
        >
          {isIn ? "+" : isOut ? "−" : ""}
          {formatMoney(row.amount)}
        </p>
        <span
          className={cn(
            "inline-block text-[11px] font-medium tracking-wide",
            isIn && "text-[var(--success)]/80",
            isOut && "text-[var(--danger)]/80",
            isVoid && "text-[var(--ink-muted)]",
          )}
        >
          {isIn ? "Money In" : isOut ? "Money Out" : "Void"}
        </span>
      </td>

      {/* 9. Actions */}
      <td className="px-4 py-3.5 pr-5 text-right align-middle">
        <div className="flex justify-end">
          <RowActions row={row} pending={pending} onAction={onAction} />
        </div>
      </td>
    </tr>
  );
}

function LedgerCard({ row, pending, onAction }) {
  const meta = TRANSACTION_KIND_META[row.kind];
  const isIn = row.direction === "in";
  const isOut = row.direction === "out";
  // Same rule as the desktop row: transfer legs never render their
  // system-generated memo inline.
  const showNotes =
    Boolean(row.notes) &&
    row.kind !== "transfer_sent" &&
    row.kind !== "transfer_received";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TransactionKindBadge kind={row.kind} />
          {row.flagged && (
            <Badge tone="danger" className="gap-1 px-1.5 py-0.5 text-[10px]">
              <Flag size={10} aria-hidden />
              <span>Flagged</span>
            </Badge>
          )}
        </div>
        <div className="text-right">
          <span
            className={cn(
              "block text-base font-semibold tabular-nums",
              isIn && "text-[var(--success)]",
              isOut && "text-[var(--danger)]",
              !isIn && !isOut && "text-[var(--ink-muted)]",
            )}
          >
            {isIn ? "+" : isOut ? "−" : ""}
            {formatMoney(row.amount)}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider",
              isIn && "text-[var(--success)]/80",
              isOut && "text-[var(--danger)]/80",
              !isIn && !isOut && "text-[var(--ink-muted)]",
            )}
          >
            {isIn ? "Money In" : isOut ? "Money Out" : "Void"}
          </span>
        </div>
      </div>

      <p
        title={row.description}
        className="mt-2 line-clamp-2 break-words text-sm font-semibold leading-snug text-[var(--ink)]"
      >
        {row.description || "Untitled"}
      </p>

      {/* Subtitle details: person, source, counterparty */}
      <p className="mt-0.5 truncate text-xs leading-snug text-[var(--ink-muted)]">
        {[
          row.employeeName ||
            (row.approvedBy ? `System (${row.approvedBy})` : "System"),
          row.referenceLabel && row.referenceLabel !== "No source of funds"
            ? row.referenceLabel
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        {row.counterpartyName
          ? ` · ${row.kind === "transfer_sent" ? "To" : "From"} ${row.counterpartyName}`
          : ""}
      </p>

      {/* Category / notes pills */}
      {(row.categoryName || showNotes) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          {row.categoryName && (
            <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--ink)]">
              {row.categoryName}
            </span>
          )}
          {showNotes && (
            <span className="truncate text-[11px] italic text-[var(--ink-muted)]">
              "{row.notes}"
            </span>
          )}
        </div>
      )}

      {/* Bottom meta row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--border)] pt-2.5">
        <StatusBadge status={row.status} />

        {row.method && (
          <span
            title={methodLabel(row.method)}
            className="inline-flex max-w-full items-center rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--ink)]"
          >
            <span className="min-w-0 truncate">{methodLabel(row.method)}</span>
          </span>
        )}

        <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
          {formatDate(row.date)}
        </span>

        <RowActions row={row} pending={pending} onAction={onAction} />
      </div>

      {meta && <span className="sr-only">{meta.label}</span>}
    </div>
  );
}

const COLUMN_WIDTHS = [
  "9%", // Date
  "22%", // Description — widest text column, takes from Type + Method
  "10%", // Type — badges only, truncates to fit
  "7%", // Method — short labels (Cash / E-Wallet / Bank Transfer), truncates
  "15%", // Account / Person
  "9%", // Reference
  "8%", // Status
  "14%", // Amount & Flow
  "6%", // Actions
];

const HEADERS = [
  { label: "Date" },
  { label: "Description" },
  { label: "Type" },
  { label: "Method" },
  { label: "Account / Person" },
  { label: "Reference" },
  { label: "Status" },
  { label: "Amount", align: "right" },
  { label: "Actions", srOnly: true, align: "right" },
];

const TransactionsTable = ({ rows, pending = false, onAction }) => (
  <>
    <div
      className="hidden overflow-x-auto rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
      tabIndex={0}
      aria-label="All transactions"
    >
      <div className="relative min-w-[1360px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
        />

        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            Unified transactions ledger with date, description, type, method,
            person, reference, status, amount flow and row actions
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
                      "text-left": h.align === "left" || !h.align,
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
                key={row.key}
                row={row}
                pending={pending}
                onAction={onAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <LedgerCard
          key={row.key}
          row={row}
          pending={pending}
          onAction={onAction}
        />
      ))}
    </div>
  </>
);

export default TransactionsTable;
