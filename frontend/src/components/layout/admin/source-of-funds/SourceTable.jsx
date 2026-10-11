import { motion, AnimatePresence } from "framer-motion";
import { Eye, Pencil, Trash2, Wallet } from "lucide-react";
import { Pager } from "../../../ui/Pager";
import { cn, formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { InvolvedStack, StatusBadge } from "./SourceBadges";
import { ActionButton, RowMenu } from "./SourceRowMenu";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

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

/**
 * Desktop fund-vault card — one source of funds rendered as a card holding
 * money, so it reads as a fund at a glance. Carries every detail the table
 * row did: Source (label + notes), Allocated (hero), Issued, Spent,
 * Remaining, Account / Person, Txns, Status, Date Cut-off, Created, Actions.
 */
function SourceFundCard({ source, onView, onEdit, onDelete }) {
  const allocated = toMoney(source.allocated ?? 0);
  const issued = toMoney(source.issued ?? 0);
  const spent = toMoney(source.expenses ?? 0);
  const remaining = toMoney(source.remaining ?? 0);
  const used = toMoney(issued + spent);
  const overSpent = remaining < 0;
  const closed = source.status !== "open";
  const txns = Number(source.transactions) || 0;
  const involvedCount = Number(source.involved_count) || 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5",
        closed && "opacity-70",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      {/* Identity — fund vault mark, label, status, actions */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Wallet size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]"
            title={source.label}
          >
            {source.label || "Untitled source"}
          </p>
          <p
            className="mt-0.5 truncate text-xs text-[var(--ink-muted)]"
            title={source.notes}
          >
            {source.notes || "Source of funds"}
          </p>
        </div>
        <StatusBadge status={source.status} />
        <RowMenu
          source={source}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
      {/* Money hero — the allocated fund with its utilization */}
      <div className="mt-3 rounded-2xl bg-[var(--surface-2)]/60 px-4 py-3.5 ring-1 ring-inset ring-[var(--border)]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="type-eyebrow text-[var(--ink-muted)]">
            Allocated fund
          </p>
          <p className="truncate text-xs tabular-nums text-[var(--ink-muted)]">
            <span
              className={cn(
                "font-medium",
                overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
              )}
            >
              {formatMoney(remaining)}
            </span>{" "}
            left
          </p>
        </div>
        <p className="mt-1 truncate font-display text-2xl font-medium tracking-tight tabular-nums text-[var(--ink)]">
          {formatMoney(allocated)}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <UtilizationBar used={used} total={allocated} />
          <span className="shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
            {txns} {txns === 1 ? "txn" : "txns"}
          </span>
        </div>
      </div>
      {/* Money legs — issued / spent / remaining */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2.5 text-center">
          <p className="type-eyebrow text-[var(--ink-muted)]">Issued</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
            {formatMoney(issued)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2.5 text-center">
          <p className="type-eyebrow text-[var(--ink-muted)]">Spent</p>
          <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
            {formatMoney(spent)}
          </p>
        </div>
        <div
          className={cn(
            "min-w-0 rounded-xl border px-3 py-2.5 text-center",
            overSpent
              ? "border-[var(--danger)]/30 bg-[var(--danger)]/10"
              : "border-[var(--border)]/70 bg-[var(--surface)]",
          )}
        >
          <p className="type-eyebrow text-[var(--ink-muted)]">Remaining</p>
          <p
            className={cn(
              "mt-1 truncate text-sm font-medium tabular-nums",
              overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
            )}
          >
            {formatMoney(remaining)}
          </p>
        </div>
      </div>
      {/* People + dates footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <InvolvedStack
            people={source.involved}
            total={source.involved_count}
          />
          <span className="whitespace-nowrap tabular-nums">
            {involvedCount} {involvedCount === 1 ? "person" : "people"}
          </span>
        </span>
        <span className="whitespace-nowrap tabular-nums">
          Cut off{" "}
          {source.date_cut_off
            ? `${formatDate(source.date_cut_off)} · ${formatTime(source.date_cut_off)}`
            : "N/A"}
        </span>
        <span className="ml-auto whitespace-nowrap tabular-nums">
          Added {formatDate(source.created_at)}
          {source.created_at ? ` · ${formatTime(source.created_at)}` : ""}
        </span>
      </div>
    </div>
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

// Loading mirror shared with the All Sources card: desktop fund-vault cards
// plus mobile stacked cards, so the skeleton paints into the same frames as
// the real rows with no layout shift.
export function SourceTableSkeleton({ desktopCount = 4, mobileCount = 3 }) {
  return (
    <div role="status" aria-label="Loading budget sources">
      <div
        aria-hidden
        className="hidden grid-cols-1 gap-3 md:grid xl:grid-cols-2"
      >
        {Array.from({ length: desktopCount }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-[var(--border)]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--border)]" />
              </div>
              <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
            <div className="mt-3 rounded-2xl bg-[var(--surface-2)]/60 px-4 py-3.5 ring-1 ring-inset ring-[var(--border)]">
              <div className="flex items-baseline justify-between gap-2">
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
              </div>
              <div className="mt-2 h-7 w-44 animate-pulse rounded-lg bg-[var(--border)]" />
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1 flex-1 animate-pulse rounded-full bg-[var(--border)]" />
                <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="rounded-xl border border-[var(--border)]/70 px-3 py-2.5"
                >
                  <div className="mx-auto h-3 w-12 animate-pulse rounded bg-[var(--border)]" />
                  <div className="mx-auto mt-1.5 h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-[var(--border)] pt-3">
              <div className="h-4 w-28 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
              <div className="ml-auto h-3 w-20 animate-pulse rounded bg-[var(--border)]" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: mobileCount }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--border)]" />
              </div>
              <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface-2)]/60 p-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-1.5">
                  <div className="mx-auto h-3 w-14 animate-pulse rounded bg-[var(--border)]" />
                  <div className="mx-auto h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 animate-pulse rounded-full bg-[var(--border)]" />
              <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-[var(--border)]" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
              <div className="flex shrink-0 items-center gap-0.5">
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    className="h-7 w-7 animate-pulse rounded-full bg-[var(--border)]"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
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
      {/* Desktop — fund-vault cards instead of a table: each source reads as
          a card holding money (allocated hero + legs), with every detail the
          table row carried. */}
      <div
        role="list"
        aria-label="Budget sources"
        className="hidden grid-cols-1 gap-3 md:grid xl:grid-cols-2"
      >
        {
          <AnimatePresence>
            {pageRows.map((source) => (
              <motion.div
                key={source.reference_id}
                layout
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95 }}
                variants={cardVariants}
              >
                <SourceFundCard
                  source={source}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        }
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
