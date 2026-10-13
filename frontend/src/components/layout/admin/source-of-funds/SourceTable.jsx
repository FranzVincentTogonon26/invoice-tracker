import { motion, AnimatePresence } from "framer-motion";
import { Eye, Pencil, Trash2, Wallet } from "lucide-react";
import { Pager } from "../../../ui/Pager";
import { cn, formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { InvolvedStack, StatusBadge } from "./SourceBadges";
import { ActionButton, RowMenu } from "./SourceRowMenu";
import { tableRowVariants } from "@/lib/tableAnimation";

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

// Loading mirror: desktop table rows plus mobile stacked cards, so the
// skeleton paints into the same frames as the real content with no layout
// shift.
export function SourceTableSkeleton({ desktopCount = 4, mobileCount = 3 }) {
  return (
    <div role="status" aria-label="Loading budget sources">
      <div
        aria-hidden
        className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card md:block"
      >
        <table className="w-full min-w-[1320px] table-fixed border-collapse text-left">
          <thead className="bg-[var(--surface-2)]">
            <tr>
              {[
                "Source",
                "Allocated",
                "Issued",
                "Spent",
                "Remaining",
                "People",
                "Txns",
                "Status",
                "Cut off",
                "Added",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-4 last:pr-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {Array.from({ length: desktopCount }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3.5 first:pl-4 align-middle">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-[var(--border)]" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/5 animate-pulse rounded bg-[var(--border)]" />
                      <div className="h-2.5 w-3/5 animate-pulse rounded bg-[var(--border)]" />
                    </div>
                  </div>
                </td>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3.5 align-middle last:pr-4">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--border)]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
      {/* Desktop — data table: one row per source with every detail the
          cards carry (label + notes, allocated, issued, spent, remaining,
          people, txns, status, cut-off, added, actions). */}
      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block">
        <table className="w-full min-w-[1320px] table-fixed border-collapse text-left">
          <caption className="sr-only">Budget sources ledger</caption>
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]">
            <tr>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-4"
              >
                Source
              </th>
              {["Allocated", "Issued", "Spent", "Remaining"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]"
                >
                  {h}
                </th>
              ))}
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]"
              >
                People
              </th>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-center type-eyebrow text-[var(--ink-muted)]"
              >
                Txns
              </th>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]"
              >
                Status
              </th>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]"
              >
                Cut off
              </th>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]"
              >
                Added
              </th>
              <th
                scope="col"
                className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-center type-eyebrow text-[var(--ink-muted)] last:pr-4"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {pageRows.map((source) => {
                const remaining = toMoney(source.remaining ?? 0);
                const overSpent = remaining < 0;
                const txns = Number(source.transactions) || 0;
                const involvedCount = Number(source.involved_count) || 0;
                // Total spent for display: admin + employee + settled legs.
                // (Remaining still subtracts the admin leg only — the other
                // two already left as issued, so they must not reduce it.)
                const spentTotal = toMoney(
                  Number(source.expenses) +
                    Number(source.employeeExpenses) +
                    Number(source.settledAbono),
                );
                return (
                  <motion.tr
                    key={source.reference_id}
                    layout
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    variants={tableRowVariants}
                    className="transition-colors duration-150 hover:bg-[var(--accent)]/[0.04]"
                  >
                    <td className="px-4 py-3.5 first:pl-4 align-middle">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                          <Wallet size={15} aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-medium text-[var(--ink)]"
                            title={source.label}
                          >
                            {source.label || "Untitled source"}
                          </p>
                          <p
                            className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]"
                            title={source.notes}
                          >
                            {source.notes || "Source of funds"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]">
                        {formatMoney(source.allocated)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]">
                        {formatMoney(source.issued)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span
                        className="whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]"
                        title={`Total spent: ${formatMoney(source.expenses)} admin + ${formatMoney(source.employeeExpenses)} employee + ${formatMoney(source.settledAbono)} settled`}
                      >
                        {formatMoney(spentTotal)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span
                        className={cn(
                          "whitespace-nowrap text-sm font-medium tabular-nums",
                          overSpent
                            ? "text-[var(--danger)]"
                            : "text-[var(--accent-strong)]",
                        )}
                      >
                        {formatMoney(remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <InvolvedStack
                          people={source.involved}
                          total={source.involved_count}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span
                        className="whitespace-nowrap text-xs tabular-nums text-[var(--ink-muted)]"
                        title={`${txns} ${txns === 1 ? "transaction" : "transactions"}`}
                      >
                        {txns}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusBadge status={source.status} />
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {source.date_cut_off ? (
                        <>
                          <p className="whitespace-nowrap text-xs text-[var(--ink)]">
                            {formatDate(source.date_cut_off)}
                          </p>
                          <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
                            {formatTime(source.date_cut_off)}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--ink-muted)]">
                          N/A
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <p className="whitespace-nowrap text-xs text-[var(--ink)]">
                        {source.created_at
                          ? formatDate(source.created_at)
                          : "—"}
                      </p>
                      {source.created_at && (
                        <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
                          {formatTime(source.created_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 pr-4 text-center align-middle">
                      <RowMenu
                        source={source}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
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
