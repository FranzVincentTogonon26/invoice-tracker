import { useMemo, useState } from "react";
import { Inbox, Search, Users, X } from "lucide-react";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { SearchInput } from "../../../ui/Input";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";

// Date + AM/PM time stacked cell (used by the Date Created / Date Closed
// columns). Renders "—" when there is no date — e.g. never closed yet.
function DateTimeCell({ value }) {
  if (!value) return <span className="text-[13px] text-[var(--ink-muted)]">—</span>;
  return (
    <>
      <p className="whitespace-nowrap text-[13px] text-[var(--ink)]">
        {formatDate(value)}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-[var(--ink-muted)]">
        {formatTime(value)}
      </p>
    </>
  );
}
import { PersonnelActions } from "./PersonnelActions";

// Personnel ledger: one row per `budget_issued_reference` record (any
// status) under an open source — keyed by the record's own id, with its
// holder, source, status, dates and per-record legs.
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
      <CardHeader className="mb-3 flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Users size={18} />
          </span>
          <div>
            <CardTitle className="text-base">Personnel</CardTitle>
            <CardDescription className="mt-0.5">
              Every issuance reference, live or closed — holdings, abono and
              spending per record
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
          title={search ? "No matching records" : "No issuance records found"}
          description={
            search
              ? `No records matched "${search}". Try clearing your search.`
              : "No issuance references exist yet."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <table className="w-full min-w-[1360px] table-fixed border-collapse text-left">
            <caption className="sr-only">
              Personnel reimbursement ledger
            </caption>
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
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
                  Issued Budget
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Total Open Abono
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Total Spent
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-right type-eyebrow text-[var(--ink-muted)]">
                  Remaining Balance
                </th>
                <th className="truncate whitespace-nowrap border-b border-[var(--border)] px-4 py-3 text-center type-eyebrow text-[var(--ink-muted)]">
                  Total Transaction
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
              {filtered.map((r) => (
                <tr
                  key={r.id ?? r.userId}
                  className="transition-colors duration-150 hover:bg-[var(--accent)]/[0.05]"
                >
                  <td className="px-4 py-3.5 first:pl-5 align-middle">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <EmployeeAvatar
                        name={r.name}
                        avatarUrl={r.avatarUrl}
                        className="h-8 w-8 text-xs"
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
                    {r.referenceLabel ?? r.referenceLabels ? (
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
                    <span className="whitespace-nowrap font-display text-[15px] font-medium tabular-nums text-[var(--ink)]">
                      {formatMoney(r.issued)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <span className="whitespace-nowrap font-display text-[15px] font-medium tabular-nums text-[var(--warning)]">
                      {formatMoney(r.openAbono)}
                    </span> 
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <span className="whitespace-nowrap font-display text-[15px] font-medium tabular-nums text-[var(--danger)]">
                      {formatMoney(r.spent)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <span
                      className={cn(
                        "whitespace-nowrap font-display text-[15px] font-medium tabular-nums",
                        r.balance < 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--accent-strong)]",
                      )}
                    > 
                      {formatMoney(r.balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <Badge tone="accent" className="font-medium">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default ReimbursementPersonnelTable;
