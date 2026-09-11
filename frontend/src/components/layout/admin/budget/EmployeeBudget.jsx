import { ArrowRight, Loader, Wallet } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { StatusBadge } from "../../../ui/Badge";
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
              className="group flex items-center gap-3 py-3 text-left hover:opacity-90 transition-opacity"
            >
              <div className="h-9 w-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center font-semibold text-sm shrink-0">
                {employee.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--ink)] truncate">
                  {employee.name}
                </div>
                <div className="text-xs text-[var(--ink-muted)] tabular">
                  Recently Issued · {formatDate(employee.recent_date)}
                </div>
              </div>
              <div className="text-sm font-semibold text-[var(--ink)] tabular shrink-0">
                {formatMoney(employee.total_amount)}
              </div>
              <StatusBadge status="pending" />
              <ArrowRight
                size={14}
                className="text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default EmployeeBudget;
