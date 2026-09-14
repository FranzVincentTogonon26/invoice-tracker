import { useMemo } from "react";
import { ChevronRight, Loader, Wallet } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
import { formatDate, formatMoney } from "../../../../lib/utils";

const EmployeeBudget = ({ employeeIssuedBudget = [], isLoading, onOpen }) => {
  const groups = useMemo(
    () =>
      employeeIssuedBudget.reduce((acc, row) => {
        let group = acc.find((g) => g.user_id === row.user_id);
        if (!group) {
          group = {
            user_id: row.user_id,
            name: row.name,
            budgets: [],
            labelGroups: {},
          };
          acc.push(group);
        }
        group.budgets.push(row);

        const labelKey = row.label?.trim() || "Untitled reference";
        let labelGroup = group.labelGroups[labelKey];
        if (!labelGroup) {
          labelGroup = {
            label: labelKey,
            total: 0,
            recent_date: null,
            count: 0,
          };
          group.labelGroups[labelKey] = labelGroup;
        }
        labelGroup.total += Number(row.total_amount ?? 0);
        labelGroup.count += 1;
        if (
          !labelGroup.recent_date ||
          new Date(row.recent_date) > new Date(labelGroup.recent_date)
        ) {
          labelGroup.recent_date = row.recent_date;
        }
        return acc;
      }, []),
    [employeeIssuedBudget],
  );

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Employee with Budget</CardTitle>
          <CardDescription>Manage employee budget allocations.</CardDescription>
        </div>
        {!isLoading && groups.length > 0 && (
          <Badge tone="neutral" className="shrink-0">
            {groups.length} {groups.length === 1 ? "employee" : "employees"}
          </Badge>
        )}
      </CardHeader>
      {isLoading ? (
        <div className="py-14 flex flex-col items-center text-center">
          <Loader size={20} className="animate-spin text-[var(--ink-muted)]" />
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Loading budgets…
          </p>
        </div>
      ) : employeeIssuedBudget.length === 0 ? (
        <div className="py-14 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
            No budgets issued yet
          </p>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
            Use the{" "}
            <span className="font-medium text-[var(--accent-strong)]">
              Budget Issued
            </span>{" "}
            button to create the first one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {groups.map((group) => {
            const labelList = Object.values(group.labelGroups);
            const total = labelList.reduce(
              (sum, lg) => sum + Number(lg.total ?? 0),
              0,
            );
            // Expanded design only pays off with multiple references;
            // with 0–1 reference the row compresses to name + total.
            const hasMultipleRefs = labelList.length > 1;
            const singleRef = labelList[0];
            return (
              <button
                key={group.user_id}
                type="button"
                onClick={() => onOpen(group.user_id)}
                className={`group/row w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-all duration-200  hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 hover:shadow-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 ${
                  hasMultipleRefs ? "px-3.5 py-3" : "px-3.5 py-2"
                }`}
              >
                {/* Employee header — identity left, aggregate total right */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex shrink-0 select-none items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--accent)]/15 transition-all duration-200 group-hover/row:scale-105 group-hover/row:ring-[var(--accent)]/40 ${
                      hasMultipleRefs
                        ? "h-9 w-9 text-[13px]"
                        : "h-8 w-8 text-xs"
                    }`}
                  >
                    {group.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {group.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                      {group.budgets.length}{" "}
                      {group.budgets.length === 1 ? "budget" : "budgets"} ·{" "}
                      {labelList.length}{" "}
                      {labelList.length === 1 ? "reference" : "references"}
                      {!hasMultipleRefs && singleRef && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-semibold">
                            {singleRef.label}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[var(--ink)] tabular-nums transition-colors duration-200 group-hover/row:text-[var(--accent-strong)]">
                    {formatMoney(total)}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-[var(--ink-muted)] transition-all duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-[var(--accent)]"
                  />
                </div>

                {/* References — soft inset rows: dot · label · count · date · total */}
                {hasMultipleRefs && (
                  <div className="mt-2.5 ml-12 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    {labelList.map((labelGroup, i) => (
                      <div
                        key={labelGroup.label}
                        className={`flex items-center gap-2.5 px-3 py-2 ${
                          i > 0 ? "border-t border-[var(--border)]" : ""
                        }`}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/50" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--ink)]">
                          {labelGroup.label}
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                          {labelGroup.count}{" "}
                          {labelGroup.count === 1 ? "issue" : "issues"}
                        </span>
                        <span className="hidden shrink-0 text-[11px] text-[var(--ink-muted)] sm:block">
                          {formatDate(labelGroup.recent_date)}
                        </span>
                        <span className="min-w-[5.5rem] shrink-0 text-right text-[13px] font-semibold text-[var(--accent-strong)] tabular-nums">
                          {formatMoney(labelGroup.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default EmployeeBudget;
