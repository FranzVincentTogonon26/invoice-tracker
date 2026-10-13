import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox, Search, Users, X } from "lucide-react";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { SearchInput } from "../../../ui/Input";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";
import { PersonnelActions } from "./PersonnelActions";
import { tableRowVariants } from "@/lib/tableAnimation";

// Date + AM/PM time stacked cell (used by the Date Created / Date Closed
// columns). Renders "—" when there is no date — e.g. never closed yet.
function DateTimeCell({ value }) {
  if (!value) return <span className="text-xs text-[var(--ink-muted)]">—</span>;
  return (
    <>
      <p className="whitespace-nowrap text-xs text-[var(--ink)]">
        {formatDate(value)}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
        {formatTime(value)}
      </p>
    </>
  );
}

// Personnel ledger: one row per `budget_issued_reference` record holding
// LIVE money under an open source — keyed by the record's own id, with its
// holder, source, status, dates and per-record legs. A record appears only
// when at least one of its `issued_budget` children has `status = 'added'`;
// fully-cancelled (or childless) records hold nothing and stay hidden, and
// the Issued Budget / Total Transaction legs sum and count `added` children
// only.
export function ReimbursementPersonnelTable({
  rows = [],
  isLoading,
  onViewEmployee,
  onViewReimbursement,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.name,
        r.email,
        r.referenceLabel ?? r.referenceLabels,
        r.role,
        r.status ?? r.birStatuses,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <Card className="overflow-hidden px-2.5">
      <CardHeader className="mb-2 flex-col gap-3 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Users size={18} />
          </span>
          <div>
            <CardTitle className="text-base">Personnel</CardTitle>
            <CardDescription className="mt-0.5">
              Issuance references holding live budget — holdings, abono,
              transfers and spending per record
            </CardDescription>
          </div>
        </div>
        <div className="flex w-full flex-1 items-center gap-2 md:max-w-sm">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search personnel..."
            aria-label="Search personnel"
            className="min-w-0 flex-1"
            rightSlot={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null
            }
          />
          {!isLoading && (
            <Badge
              tone="neutral"
              className="hidden shrink-0 tabular-nums sm:inline-flex"
            >
              {filtered.length} {filtered.length === 1 ? "record" : "records"}
            </Badge>
          )}
        </div>
      </CardHeader>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search ? "No matching records" : "No live issuance records"}
          description={
            search
              ? `No records matched "${search}". Try clearing your search.`
              : "No issuance references hold live budget yet."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <table className="w-full min-w-[1480px] table-fixed border-collapse text-left">
            <caption className="sr-only">
              Personnel reimbursement ledger
            </caption>
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]">
              <tr>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)] first:pl-5">
                  Personnel
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                  Reference
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Budget
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Abono
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Transfer
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Spent
                </th>

                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Remaining
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-center type-eyebrow text-[var(--ink-muted)]">
                  Transaction
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                  Date Created
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                  Date Closed
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 type-eyebrow text-[var(--ink-muted)]">
                  Status
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)] last:pr-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              <AnimatePresence initial={false}>
                {filtered.map((r) => (
                <motion.tr
                  key={r.id ?? r.userId}
                  layout
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  variants={tableRowVariants}
                  className="transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]"
                >
                  <td className="px-4 py-3.5 first:pl-5 align-middle">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <EmployeeAvatar
                        name={r.name}
                        avatarUrl={r.avatarUrl}
                        className="h-7 w-7 text-[11px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                          {r.name || "—"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] capitalize text-[var(--ink-muted)]">
                          {r.role || "employee"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    {(r.referenceLabel ?? r.referenceLabels) ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {String(r.referenceLabel ?? r.referenceLabels)
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((label, i) => (
                            <Badge
                              key={`${r.id ?? r.userId}-ref-${i}`}
                              tone="neutral"
                              title={label}
                              className="max-w-full truncate text-xs"
                            >
                              {label}
                            </Badge>
                          ))}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[var(--ink-muted)]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <span className="whitespace-nowrap font-display text-sm font-medium tabular-nums text-[var(--ink)]">
                      {formatMoney(r.issued)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    {!(
                      Number(r.openAbono) > 0 || Number(r.settledAbono) > 0
                    ) ? (
                      <span className="text-sm leading-none text-[var(--ink-muted)]">
                        —
                      </span>
                    ) : (
                      <div className="space-y-0.5">
                        {Number(r.settledAbono) > 0 && (
                          <p
                            className="flex items-center justify-end gap-1.5 text-xs tabular-nums"
                            title={`${formatMoney(r.settledAbono)} settled abono`}
                          >
                            <span className="text-sm font-medium tabular-nums  text-[var(--warning)]">
                              - {formatMoney(r.settledAbono)}
                            </span>
                          </p>
                        )}
                        {Number(r.openAbono) > 0 && (
                          <p
                            className="whitespace-nowrap font-display text-sm font-medium tabular-nums  text-[var(--warning)]"
                            title={`${formatMoney(r.openAbono)} open abono held`}
                          >
                            + {formatMoney(r.openAbono)}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <div className="space-y-0.5">
                      {Number(r.received) > 0 && (
                        <p
                          className="flex items-center justify-end gap-1.5 text-xs tabular-nums"
                          title={`${formatMoney(r.received)} received from budget transfers`}
                        >
                          <span className="text-sm font-medium tabular-nums  text-[var(--success)]">
                            + {formatMoney(r.received)}
                          </span>
                        </p>
                      )}
                      {Number(r.sent) > 0 && (
                        <p
                          className="flex items-center justify-end gap-1.5 text-xs tabular-nums"
                          title={`${formatMoney(r.sent)} sent via budget transfers`}
                        >
                          <span className="text-sm font-medium tabular-nums  text-[var(--danger)]">
                            - {formatMoney(r.sent)}
                          </span>
                        </p>
                      )}
                      {!(Number(r.received) > 0 || Number(r.sent) > 0) && (
                        <span className="text-sm font-medium tabular-nums  leading-none text-[var(--ink-muted)]">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <span className="whitespace-nowrap font-display text-sm font-medium tabular-nums text-[var(--danger)]">
                      {formatMoney(r.spent)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right align-middle">
                    <span
                      className={cn(
                        "whitespace-nowrap font-display text-sm font-medium tabular-nums",
                        r.balance < 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--accent-strong)]",
                      )}
                    >
                      {formatMoney(r.balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <Badge
                      tone="accent"
                      className="font-medium"
                      title={`${r.issuedCount ?? 0} live issuance entries`}
                    >
                      {r.issuedCount ?? 0}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <DateTimeCell value={r.dateCreated} />
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <DateTimeCell value={r.dateClosed} />
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {String(r.status ?? r.birStatuses ?? "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((s) => (
                          <StatusBadge
                            key={`${r.id ?? r.userId}-${s}`}
                            status={s}
                            dot={false}
                          />
                        ))}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 pr-5 text-right align-middle">
                    <PersonnelActions
                      onViewEmployee={() => onViewEmployee?.(r)}
                      onViewReimbursement={() => onViewReimbursement?.(r)}
                    />
                  </td>
                </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default ReimbursementPersonnelTable;
