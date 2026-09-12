import { ArrowRight, Loader, Wallet } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { formatDate, formatMoney } from "../../../../lib/utils";

const EmployeeBudget = ({ employeeIssuedBudget = [], isLoading, onOpen }) => {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Employee with Budget</CardTitle>
          <CardDescription>Manage employee budget allocations.</CardDescription>
        </div>
      </CardHeader>
      {isLoading ? (
        <div className="py-10 text-center text-sm text-[var(--ink-muted)] space-y-1">
          <span className="flex justify-center items-center">
            <Loader
              size={20}
              className="text-[var(--ink-muted)] animate-spin"
            />
          </span>
          <span>Loading budgets…</span>
        </div>
      ) : employeeIssuedBudget.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--ink-muted)] space-y-1">
          <span className="flex justify-center items-center">
            <Wallet size={40} className="text-[var(--ink-muted)]" />
          </span>
          <span>No Budget Issued..</span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {employeeIssuedBudget.map((employee) => (
            <button
              key={employee.user_id}
              onClick={() => onOpen(employee.user_id)}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors duration-200 hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none"
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center font-semibold text-sm shrink-0  transition-transform duration-200 group-hover:scale-105">
                {employee.name?.[0]?.toUpperCase() || "?"}
              </div>

              {/* Name + meta line */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--ink)] truncate transition-colors duration-200 group-hover:text-[var(--accent-strong)]">
                  {employee.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)] min-w-0">
                  <Badge tone="neutral" className="shrink-0">
                    {employee.total_budget_issued}{" "}
                    {employee.total_budget_issued === 1 ? "budget" : "budgets"}
                  </Badge>
                  <span className="truncate">
                    Recently issued · {formatDate(employee.recent_date)}
                  </span>
                </div>
              </div>

              {/* Right-aligned summary */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--ink)] tabular transition-colors duration-200 group-hover:text-[var(--accent-strong)]">
                    {formatMoney(employee.total_amount)}
                  </div>
                  <div className="text-[11px] text-[var(--ink-muted)]">
                    Total issued
                  </div>
                </div>
                <StatusBadge
                  status="pending"
                  className="hidden lg:inline-flex"
                />
                <ArrowRight
                  size={14}
                  className="text-[var(--accent-strong)] opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default EmployeeBudget;
