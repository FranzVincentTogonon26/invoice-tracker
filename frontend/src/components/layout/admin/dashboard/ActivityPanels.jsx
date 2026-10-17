import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatDate, formatMoney, formatTime, toMoney } from "../../../../lib/utils";
import { CHART_EASE as EASE } from "../../../../lib/dashboard";
import { StatusBadge } from "../../../ui/Badge";
import { Card } from "../../../ui/Card";
import { LoadingSkeleton } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { TransactionKindBadge } from "../transactions/TransactionsTable";

const toNumber = (value) => Number(value) || 0;

// Pool legs that bust a source's open budget. Transfers never touch the pool
// (employee → employee), so they only adjust an already-proven holder.
const POOL_KINDS = new Set(["budget", "issued", "expense", "abono"]);

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

function EmptyNote({ children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]"
      >
        <Inbox size={16} />
      </span>
      <p className="text-xs text-[var(--ink-muted)]">{children}</p>
    </div>
  );
}

function SectionLabel({ children, count }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1.5">
      <span className="type-eyebrow text-[var(--ink-muted)]">{children}</span>
      {count != null && (
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--ink-muted)]">
          {count}
        </span>
      )}
    </div>
  );
}

/* ── Right column: the 20 newest ledger records as a plain table ─────────
   Shares the unified ledger + cell conventions of TransactionsTable
   (kind badges, StatusBadge, avatar person cell, signed colored amounts)
   but reads only — no search, filters or row actions. */
export function RecentTransactionsCard({ transactions, isLoading }) {
  const rows = useMemo(
    () =>
      [...(transactions ?? [])]
        .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
        .slice(0, 15),
    [transactions],
  );
  const total = (transactions ?? []).length;

  return (
    <Card
      padding="none"
      radius="lg"
      className="relative flex h-full flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
        <div>
          <h3 className="font-display text-base font-medium leading-snug tracking-tight text-[var(--ink)]">
            Recent transactions
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
            Latest 15 records of the live ledger.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--ink-muted)]">
          {total} {total === 1 ? "record" : "records"}
        </span>
      </div>

      {isLoading ? (
        <div className="px-3 pb-4 sm:px-4">
          <LoadingSkeleton rows={8} showAvatar />
        </div>
      ) : rows.length === 0 ? (
        <EmptyNote>No transactions recorded yet.</EmptyNote>
      ) : (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <caption className="sr-only">
              The 15 most recent transactions with date, description, type,
              person, status and amount
            </caption>
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "29%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              {/* Canonical header chrome, same as TransactionsTable: tinted
                  band + eyebrow tracking + accent hairline under the row. */}
              <tr className="bg-[var(--surface-2)]/90 backdrop-blur">
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom first:pl-5"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom"
                >
                  Account / Person
                </th>
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="border-b border-[var(--accent)]/30 px-4 py-3 text-right type-eyebrow tracking-[0.15em] text-[var(--ink-muted)] align-bottom last:pr-5"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isIn = row.direction === "in";
                const isOut = row.direction === "out";
                const isVoid = row.direction === "void";
                return (
                  <tr
                    key={
                      row.id ??
                      `${row.kind ?? "row"}-${row.referenceId ?? i}-${row.date ?? i}-${i}`
                    }
                    className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--accent)]/[0.04]"
                  >
                    {/* Date */}
                    <td className="px-4 py-3 align-middle first:pl-5">
                      <p className="text-[13px] font-medium leading-none text-[var(--ink)]">
                        {formatDate(row.date)}
                      </p>
                      <p className="mt-1 text-xs leading-none text-[var(--ink-muted)]">
                        {formatTime(row.date)}
                      </p>
                    </td>

                    {/* Description */}
                    <td className="min-w-0 max-w-0 px-4 py-3 align-middle">
                      <p
                        title={row.description}
                        className="truncate text-[13px] font-medium leading-snug text-[var(--ink)]"
                      >
                        {row.description || "Untitled"}
                      </p>
                    </td>

                    {/* Type */}
                    <td className="min-w-0 max-w-0 px-4 py-3 align-middle">
                      <TransactionKindBadge kind={row.kind} />
                    </td>

                    {/* Account / Person */}
                    <td className="min-w-0 max-w-0 px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar
                            name={row.employeeName}
                            avatarUrl={row.employeeAvatar}
                            className="h-7 w-7 text-[11px]"
                          />
                          <div className="min-w-0">
                            <p
                              title={row.employeeName}
                              className="truncate text-[13px] font-medium leading-tight text-[var(--ink)]"
                            >
                              {row.employeeName ||
                                row.approvedBy ||
                                "Boss"}
                            </p>
                            {row.employeeRole && (
                              <p className="truncate text-[10px] capitalize leading-tight text-[var(--ink-muted)]">
                                {row.employeeRole}
                              </p>
                            )}
                          </div>
                        </div>
                        {row.counterpartyName && (
                          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-[var(--ink-muted)]">
                            <ArrowLeftRight
                              size={10}
                              aria-hidden
                              className="shrink-0 text-[var(--accent)]"
                            />
                            <span className="min-w-0 truncate">
                              {row.kind === "transfer_sent" ? "To" : "From"}:{" "}
                              <span className="font-medium text-[var(--ink)]">
                                {row.counterpartyName}
                              </span>
                            </span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Amount */}
                    <td className="min-w-0 max-w-0 px-4 py-3 text-right align-middle last:pr-5">
                      <p
                        className={cn(
                          "truncate text-sm font-medium tabular-nums",
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
                          "text-[11px] font-medium tracking-wide",
                          isIn && "text-[var(--success)]/80",
                          isOut && "text-[var(--danger)]/80",
                          isVoid && "text-[var(--ink-muted)]",
                        )}
                      >
                        {isIn ? "money in" : isOut ? "money out" : "void"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ── Left column: open-budget holders + category spending ranking ─────── */

export function PoolInsightsPanel({ transactions, openSources, isLoading }) {
  const nav = useNavigate();
  // Employees whose currently-OPEN sources issued money: totals issued vs a
  // running remaining (issued + abono + received transfers − spent − sent).
  // Two exclusions keep every figure in lockstep with the canonical per-
  // employee math (AdminEmployees overview / budgetBreakdown):
  //   - closed-source history stays out (rows must reference an open source);
  //   - each leg is pinned to an OPEN holding — a finalized
  //     (`budget_issued_reference.status = 'close'`) holding hands its
  //     leftover back and stops funding the pool, so its spend/abono and
  //     remaining issuance disappear here exactly like they do in the SQL
  //     the admin overview uses.
  // Only holders WITH a remaining balance are listed (remaining > 0); a
  // fully-spent or overdrawn account is not a current balance holder.
  // With these gates the remaining figure matches EmployeesTable's remaining
  // column (budgetBreakdown over the server-computed legs) cent-for-cent for
  // every live (open-source) account.
  const participants = useMemo(() => {
    const openIds = new Set(openSources.map((s) => s.reference_id));
    const map = new Map();

    // A leg only counts while its pinned holding is OPEN. Rows without a
    // holding id/alias (legacy untagged lines) fall through as open.
    const holdingOpen = (row, field) =>
      row[field] == null || row[field] === "open";

    for (const row of transactions ?? []) {
      if (!POOL_KINDS.has(row.kind) || !row.employeeId) continue;
      if (!openIds.has(row.referenceId)) continue;

      let entry = map.get(row.employeeId);
      if (!entry) {
        entry = {
          id: row.employeeId,
          name: row.employeeName || "Unknown employee",
          role: row.employeeRole,
          avatarUrl: row.employeeAvatar,
          issued: 0,
          spent: 0,
          abono: 0,
          sent: 0,
          received: 0,
        };
        map.set(row.employeeId, entry);
      }
      if (row.kind === "issued") {
        // moneyOut is already zeroed for 'cancel' rows by the ledger's void
        // mapping; 'open' also skips 'close' rows (finalized holdings).
        if (row.parentStatus === "open") entry.issued += toNumber(row.moneyOut);
      } else if (row.kind === "expense") {
        // moneyOut is already zeroed for draft/cancel rows; the holding gate
        // drops spend that was absorbed by a finalized holding.
        if (holdingOpen(row, "issuedParentStatus"))
          entry.spent += toNumber(row.moneyOut);
      } else if (row.kind === "abono") {
        // moneyIn is already zeroed for settled rows ('void'); the holding
        // gate drops abono pinned to a finalized holding.
        if (holdingOpen(row, "holdingStatus"))
          entry.abono += toNumber(row.moneyIn);
      }
    }

    // Second pass — legs that either have no source reference or carry their
    // own holding gate, applied to employees already proven as open holders:
    //   - transfer legs (employee → employee): never change the pool, they
    //     move the holder's pocket; the gates mirror `employee.model`'s
    //     canonical totals so the figure matches EmployeesTable exactly.
    //   - legacy untagged pool rows (reference_id IS NULL — e.g. expenses
    //     saved before source tagging existed): spent still hits the
    //     holder's own balance even though no source connects it.
    for (const row of transactions ?? []) {
      const isTransfer =
        row.kind === "transfer_sent" || row.kind === "transfer_received";
      const isUntaggedPool = POOL_KINDS.has(row.kind) && !row.referenceId;
      if (!isTransfer && !isUntaggedPool) continue;

      const entry = map.get(row.employeeId);
      if (!entry) continue;

      if (row.kind === "transfer_sent") {
        // Canonical sent (employee.model): the SENDING holding must be open —
        // an unstamped or finalized/closed holding never counts. Non-success
        // statuses are already zeroed (void).
        if (row.issuedRefId == null || row.holdingStatus !== "open") continue;
        entry.sent += toNumber(row.moneyOut);
      } else if (row.kind === "transfer_received") {
        // Canonical received: an unstamped legacy row keeps counting; a
        // stamped one dies with its receiving holding (`issued_ref_id_sent`).
        if (row.sentParentStatus != null && row.sentParentStatus !== "open")
          continue;
        entry.received += toNumber(row.moneyIn);
      } else if (row.kind === "expense") {
        if (holdingOpen(row, "issuedParentStatus"))
          entry.spent += toNumber(row.moneyOut);
      } else if (row.kind === "abono") {
        if (holdingOpen(row, "holdingStatus"))
          entry.abono += toNumber(row.moneyIn);
      }
    }

    return [...map.values()]
      .filter((e) => e.issued > 0)
      .map((e) => ({
        ...e,
        remaining: toMoney(e.issued + e.abono + e.received - e.spent - e.sent),
      }))
      .filter((e) => e.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining || b.issued - a.issued);
  }, [transactions, openSources]);

  // Category spend on open sources, ranked heaviest first. The bar compares
  // each category against the heaviest one; the % label is its share of all
  // category spending.
  const categories = useMemo(() => {
    const openIds = new Set(openSources.map((s) => s.reference_id));
    const map = new Map();
    for (const row of transactions ?? []) {
      if (row.kind !== "expense" || !openIds.has(row.referenceId)) continue;
      const key =
        row.categoryId ?? `label:${row.categoryName || "uncategorized"}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          label:
            row.categoryName ||
            (row.categoryId ? `Category ${row.categoryId}` : "Uncategorized"),
          total: 0,
        };
        map.set(key, entry);
      }
      entry.total += toNumber(row.moneyOut);
    }
    return [...map.values()]
      .map((c) => ({ ...c, total: toNumber(c.total) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [transactions, openSources]);
  const maxCategory = categories[0]?.total ?? 0;
  const categoryTotal =
    categories.reduce((sum, c) => sum + c.total, 0);

  return (
    <Card
      padding="lg"
      radius="lg"
      className="flex h-full flex-col overflow-hidden"
    >
      {isLoading ? (
        <>
          <LoadingSkeleton rows={4} showAvatar />
          <div className="mt-4">
            <LoadingSkeleton rows={4} />
          </div>
        </>
      ) : (
        <>
          <SectionLabel count={participants.length}>
            Open Budget Holders
          </SectionLabel>
          {participants.length === 0 ? (
            <EmptyNote>No issued budgets on open sources yet.</EmptyNote>
          ) : (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={listVariants}
              aria-label="Employees holding issued open budget"
              className="scrollbar-inline max-h-60 space-y-0.5 overflow-y-auto pr-1 lg:max-h-64"
            >
              {participants.map((p) => (
                <motion.li key={p.id} variants={itemVariants}>
                  {/* Link row: every holder opens their own admin overview
                      (`/admin/employees/:user_id/overview`). Same clickable
                      composition as RemainingPanel's source rows — bordered,
                      hover-lift card that reads as tappable. */}
                  <button
                    type="button"
                    onClick={() => nav(`/admin/employees/${p.id}/overview`)}
                    title={`Open ${p.name}'s overview`}
                    className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-2 py-2 text-left transition-all duration-300 hover:-translate-y-px hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)] hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  >
                    <EmployeeAvatar
                      name={p.name}
                      avatarUrl={p.avatarUrl}
                      className="h-8 w-8"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        title={p.name}
                        className="truncate text-[12px] font-medium leading-tight text-[var(--ink)]"
                      >
                        {p.name}
                      </p>
                      <p
                        title={`Issued ${formatMoney(p.issued)}`}
                        className="truncate text-[10px] leading-tight text-[var(--ink-muted)]"
                      >
                        {p.role ? `${p.role} · ` : ""}
                        issued {formatMoney(p.issued)}
                      </p>
                    </div>
                    <span
                      title="Remaining balance"
                      className={cn(
                        "shrink-0 text-[12px] font-semibold tabular-nums",
                        p.remaining < 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--accent-strong)]",
                      )}
                    >
                      {formatMoney(p.remaining)}
                    </span>
                    {/* Navigation affordance — the row is tappable. */}
                    <ChevronRight
                      size={14}
                      strokeWidth={2.5}
                      aria-hidden
                      className="shrink-0 text-[var(--ink-muted)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
                    />
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}

          <div className="my-4 border-t border-[var(--border)]" />

          <SectionLabel count={categories.length}>
            Top Spending Categories
          </SectionLabel>
          {categories.length === 0 ? (
            <EmptyNote>No expenses logged on open sources yet.</EmptyNote>
          ) : (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={listVariants}
              aria-label="Categories ranked by spending on open sources"
              className="space-y-2.5"
            >
              {categories.map((cat, i) => {
                const share =
                  categoryTotal > 0
                    ? Math.round((cat.total / categoryTotal) * 100)
                    : 0;
                const width =
                  maxCategory > 0 ? Math.max(2, (cat.total / maxCategory) * 100) : 0;
                return (
                  <motion.li
                    key={cat.key}
                    variants={{ ...itemVariants, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE, delay: 0.05 + i * 0.06 } } }}
                    className="min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        title={cat.label}
                        className="min-w-0 truncate text-[12px] font-medium text-[var(--ink)]"
                      >
                        {cat.label}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-muted)]">
                        {share}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--ink)]/5">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
                          className="block h-full rounded-full bg-[var(--accent)]"
                        />
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-[var(--ink-muted)]">
                        {formatMoney(cat.total)}
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </>
      )}
    </Card>
  );
}
