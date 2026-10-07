import { motion } from "framer-motion";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Pager } from "../../../ui/Pager";
import { cn, formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { InvolvedStack, StatusBadge } from "./SourceBadges";
import { ActionButton, RowMenu } from "./SourceRowMenu";

const COLUMN_WIDTHS = [
  "18%", // Source
  "9%", // Allocated
  "9%", // Issued
  "9%", // Spent
  "10%", // Remaining
  "11%", // Account / Person
  "5%", // Txns
  "7%", // Status
  "9%", // Date Cut-off
  "7%", // Created
  "5%", // Actions
];

const HEADERS = [
  { label: "Source" },
  { label: "Allocated", align: "right" },
  { label: "Issued", align: "right" },
  { label: "Spent", align: "right" },
  { label: "Remaining" },
  { label: "Account / Person" },
  { label: "Txns", align: "center" },
  { label: "Status" },
  { label: "Date Cut-off" },
  { label: "Created" },
  { label: "Actions", srOnly: true },
];

function UtilizationBar({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const over = total > 0 && used > total;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className={cn(
          "h-full rounded-full",
          over ? "bg-[var(--danger)]" : "bg-[var(--accent)]",
        )}
      />
    </div>
  );
}

function SourceRow({ source, onView, onEdit, onDelete }) {
  const remaining = toMoney(source.remaining ?? 0);
  const overSpent = remaining < 0;
  const closed = source.status !== "open";
  return (
    <tr
      className={cn(
        "group border-b border-[var(--border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent)]/[0.04]",
        closed && "opacity-70",
      )}
    >
      <td className="px-4 py-3.5 pl-5 align-middle">
        <p
          className="truncate text-sm font-medium text-[var(--ink)]"
          title={source.label}
        >
          {source.label || "Untitled source"}
        </p>
        <p
          className="mt-0.5 truncate text-xs text-[var(--ink-muted)]"
          title={source.notes}
        >
          {source.notes}
        </p>
      </td>

      <td className="px-3 py-3.5 text-right align-middle">
        <span className="text-sm font-medium  text-[var(--ink)]">
          {formatMoney(source.allocated)}
        </span>
      </td>
      <td className="px-3 py-3.5 text-right align-middle">
        <span className="text-sm font-medium  text-[var(--ink)]">
          {formatMoney(source.issued)}
        </span>
      </td>
      <td className="px-3 py-3.5 text-right align-middle">
        <span className="text-sm font-medium  text-[var(--ink)]">
          {formatMoney(source.expenses)}
        </span>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <p
          className={cn(
            "font-display text-[15px] font-medium ",
            overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
          )}
        >
          {formatMoney(remaining)}
        </p>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <div className="flex justify-center">
          <InvolvedStack
            people={source.involved}
            total={source.involved_count}
          />
        </div>
      </td>
      <td className="px-3 py-3.5 text-center align-middle">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--surface-2)] px-2 text-xs font-normal tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--border)]">
          {Number(source.transactions) || 0}
        </span>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <StatusBadge status={source.status} />
      </td>
      <td className="px-3 py-3.5 align-middle">
        {source.date_cut_off ? (
          <>
            <p className="whitespace-nowrap text-[13px] font-medium tabular-nums text-[var(--ink)]">
              {formatDate(source.date_cut_off)}
            </p>
            <p className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
              {formatTime(source.date_cut_off)}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">N/A</p>
        )}
      </td>
      <td className="px-3 py-3.5 align-middle">
        <p className="whitespace-nowrap text-[13px] font-medium tabular-nums text-[var(--ink)]">
          {formatDate(source.created_at)}
        </p>
        <p className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
          {formatTime(source.created_at)}
        </p>
      </td>
      <td className="px-3 py-3.5 pr-4 align-middle">
        <div className="flex justify-end">
          <RowMenu
            source={source}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function SourceCard({ source, onView, onEdit, onDelete }) {
  const remaining = toMoney(source.remaining ?? 0);
  const used = toMoney(source.issued + source.expenses);
  const closed = source.status !== "open";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card",
        closed && "opacity-80",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
            {source.label || "Untitled source"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
            {formatDate(source.created_at)}
            {source.created_at ? ` · ${formatTime(source.created_at)}` : ""}
            {source.date_cut_off
              ? ` · cut off ${formatDate(source.date_cut_off)}`
              : ""}
          </p>
        </div>
        <StatusBadge status={source.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface-2)]/60 p-3 text-center ring-1 ring-inset ring-[var(--border)]">
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Allocated</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums">
            {formatMoney(source.allocated)}
          </p>
        </div>
        <div className="min-w-0 border-l border-[var(--border)] pl-2">
          <p className="type-eyebrow text-[var(--ink-muted)]">Spent</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums">
            {formatMoney(source.expenses)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--ink-muted)]">Remaining</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums">
            {formatMoney(remaining)}
          </p>
        </div>
        <div className="min-w-0 border-l border-[var(--border)] pl-2">
          <p className="type-eyebrow text-[var(--ink-muted)]">Issued</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums">
            {formatMoney(source.issued)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <UtilizationBar used={used} total={toMoney(source.allocated)} />
        <span className="shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
          {Number(source.transactions) || 0}{" "}
          {(Number(source.transactions) || 0) === 1 ? "txn" : "txns"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
        <div className="min-w-0 flex-1 text-center">
          <p className="type-eyebrow mb-1 flex justify-center text-[var(--ink-muted)]">
            Account / Person
          </p>
          <span className="inline-flex justify-center">
            <InvolvedStack
              people={source.involved}
              total={source.involved_count}
            />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ActionButton label="View source" onClick={() => onView(source)}>
            <Eye size={15} />
          </ActionButton>
          <ActionButton label="Edit source" onClick={() => onEdit(source)}>
            <Pencil size={15} />
          </ActionButton>
          <ActionButton
            label="Delete source"
            danger
            onClick={() => onDelete(source)}
          >
            <Trash2 size={15} />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function SourceTable({
  pageRows,
  rows,
  currentPage,
  pageCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <div
        className="hidden overflow-x-auto rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
        tabIndex={0}
        aria-label="Budget sources"
      >
        <div className="relative min-w-[960px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
          />
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Budget sources with status, allocated, issued, remaining,
              transactions, date cut-off, creation date and actions
            </caption>
            <colgroup>
              {COLUMN_WIDTHS.map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-[1]">
              <tr className="bg-[var(--surface-2)]/80 backdrop-blur">
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={cn(
                      "border-b border-[var(--border)] px-3 py-3.5 type-eyebrow text-[var(--ink-muted)] first:pl-5 last:pr-4",
                      {
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
              {pageRows.map((source) => (
                <SourceRow
                  key={source.reference_id}
                  source={source}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:hidden">
        {pageRows.map((source) => (
          <SourceCard
            key={source.reference_id}
            source={source}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
        <p className="text-sm tabular-nums text-[var(--ink-muted)]">
          Showing {rangeStart}–{rangeEnd} of {rows.length}{" "}
          {rows.length === 1 ? "source" : "sources"}
        </p>
        {pageCount > 1 && (
          <div className="sm:ml-auto">
            <Pager
              page={currentPage}
              pageCount={pageCount}
              onChange={onPageChange}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default SourceTable;
