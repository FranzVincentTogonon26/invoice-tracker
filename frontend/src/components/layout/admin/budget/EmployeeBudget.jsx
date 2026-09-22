import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader, Wallet } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
import { cn, formatDate, formatMoney } from "../../../../lib/utils";

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
    <Card
      padding="lg"
      className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
      />
      <CardHeader>
        <div>
          <CardTitle className="text-base text-lg">Employee budgets</CardTitle>
          <CardDescription className="text-sm">
            {groups.length === 0
              ? "Manage employee budget allocations."
              : "Tap an employee to open their profile."}
          </CardDescription>
        </div>
        {!isLoading && groups.length > 0 && (
          <Badge tone="accent" className="shrink-0 tabular-nums">
            {groups.length} {groups.length === 1 ? "employee" : "employees"}
          </Badge>
        )}
      </CardHeader>
      {isLoading ? (
        <div
          className="py-14 flex flex-col items-center text-center"
          role="status"
          aria-label="Loading employee budgets"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Loader size={18} className="animate-spin" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--ink-muted)]">
            Gathering employee budgets…
          </p>
        </div>
      ) : employeeIssuedBudget.length === 0 ? (
        <div className="py-14 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Wallet size={20} />
          </div>
          <p className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
            No budgets issued yet
          </p>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--ink-muted)]">
            Use the{" "}
            <span className="font-semibold text-[var(--accent-strong)]">
              Budget Issued
            </span>{" "}
            button to create the first one.
          </p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="flex flex-col gap-3"
          role="list"
        >
          {groups.map((group) => {
            const labelList = Object.values(group.labelGroups);
            const total = labelList.reduce(
              (sum, lg) => sum + Number(lg.total ?? 0),
              0,
            );

            const hasMultipleRefs = labelList.length > 1;
            const singleRef = labelList[0];
            return (
              <motion.button
                key={group.user_id}
                type="button"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpen(group.user_id)}
                role="listitem"
                aria-label={`Open ${group.name} budget profile, total ${formatMoney(total)}`}
                className={cn(
                  "group/row relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left shadow-card transition-colors duration-200 hover:border-[var(--accent)]/35 hover:shadow-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/30",
                  hasMultipleRefs ? "px-4 py-3.5" : "px-4 py-3",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-full bg-[var(--accent)] opacity-0 transition-opacity duration-200 group-hover/row:opacity-100"
                />
                {/* Employee header — identity left, aggregate total right */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex shrink-0 select-none items-center justify-center rounded-2xl bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--accent)]/15 transition-transform duration-200 group-hover/row:scale-105",
                      hasMultipleRefs ? "h-10 w-10 text-sm" : "h-9 w-9 text-sm",
                    )}
                  >
                    {group.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[var(--ink)]">
                      {group.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
                      <span className="tabular-nums">
                        {group.budgets.length}{" "}
                        {group.budgets.length === 1 ? "budget" : "budgets"} ·{" "}
                        {labelList.length}{" "}
                        {labelList.length === 1 ? "reference" : "references"}
                      </span>
                      {!hasMultipleRefs && singleRef && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-semibold text-[var(--ink)]">
                            {singleRef.label}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)] sm:inline-flex">
                    Latest {formatDate(singleRef?.recent_date)}
                  </span>
                  <span className="shrink-0 font-display text-base font-semibold text-[var(--ink)] tabular-nums transition-colors duration-200 group-hover/row:text-[var(--accent-strong)]">
                    {formatMoney(total)}
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--ink-muted)] transition-all duration-200 group-hover/row:border-[var(--accent)]/40 group-hover/row:bg-[var(--accent-soft)] group-hover/row:text-[var(--accent-strong)]">
                    <ChevronRight size={14} />
                  </span>
                </div>

                {/* References — soft inset rows: dot · label · count · date · total */}
                {hasMultipleRefs && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]/70 bg-[var(--surface-2)]/70">
                    {labelList.map((labelGroup, i) => (
                      <div
                        key={labelGroup.label}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5",
                          i > 0 && "border-t border-[var(--border)]",
                        )}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/60" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-[var(--ink)]">
                          {labelGroup.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--ink-muted)]">
                          {labelGroup.count}{" "}
                          {labelGroup.count === 1 ? "issue" : "issues"}
                        </span>
                        <span className="hidden shrink-0 text-xs tabular-nums text-[var(--ink-muted)] sm:block">
                          {formatDate(labelGroup.recent_date)}
                        </span>
                        <span className="min-w-[5.5rem] shrink-0 text-right text-sm font-semibold text-[var(--accent-strong)] tabular-nums">
                          {formatMoney(labelGroup.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </Card>
  );
};

export default EmployeeBudget;
