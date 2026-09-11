import {
  BadgeCheck,
  BadgeInfo,
  PhilippinePesoIcon,
  Plus,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";

import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";

import { formatMoney } from "../../lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/Tabs";
import { useState } from "react";
import EmployeeBudget from "../../components/layout/admin/budget/EmployeeBudget";
import BudgetTransaction from "../../components/layout/admin/budget/BudgetTransaction";
import BudgetModal from "../../components/layout/admin/budget/BudgetModal";
import { useNavigate } from "react-router-dom";
import { useBudgets, useBudgetMutations } from "../../hooks/useBudget";
import BudgetIssuedTransaction from "../../components/layout/admin/budget/BudgetIssuedTransaction";

export default function AdminBudget() {
  const nav = useNavigate();
  const { data, isLoading } = useBudgets();
  const { create } = useBudgetMutations();
  const [modalType, setModalType] = useState(null);
  const [tab, setTab] = useState("employee_budget");

  // Budget rows from `GET /budgets`: { user_id, name, total_amount,
  // total_budget_issued, recent_date } — used for stats, the employee
  // tab, and the employee dropdown in BudgetModal.
  const budgets = Array.isArray(data) ? data : [];
  const totalBudgetAmount = budgets.reduce(
    (sum, budget) => sum + (Number(budget.total_amount) || 0),
    0,
  );
  const totalIssued = budgets.reduce(
    (sum, budget) => sum + (Number(budget.total_budget_issued) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Manage and monitor your budget and transactions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              onClick={() => setModalType("addBudget")}
            >
              <Plus size={16} /> Add Budget
            </Button>
            <Button
              variant="accent"
              onClick={() => setModalType("issuedBudget")}
            >
              Budget Issued
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6 ">
        <StatCard
          label="Total Budget"
          value={formatMoney(totalBudgetAmount)}
          icon={TrendingUp}
          accent
        />
        {/* No backend source yet — placeholder values */}
        <StatCard
          label="Cash On Hand"
          value={formatMoney(9000)}
          icon={PhilippinePesoIcon}
        />
        <StatCard
          label="Total Issued"
          value={totalIssued}
          icon={BadgeCheck}
        />

        {/* No backend source yet — placeholder values */}
        <StatCard
          label="Overdue"
          value={5}
          suffix={formatMoney(1000)}
          icon={BadgeInfo}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employee_budget">Employees Budget</TabsTrigger>
          <TabsTrigger value="budget_transaction">
            Budget Transaction
          </TabsTrigger>
          <TabsTrigger value="budget_issued_transaction">
            Budget Issued Transaction
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="employee_budget">
            <EmployeeBudget
              employeeIssuedBudget={budgets}
              isLoading={isLoading}
              onOpen={(id) => nav(`/employee/${id}`)}
            />
          </TabsContent>
          <TabsContent value="budget_transaction">
            <BudgetTransaction />
          </TabsContent>
          <TabsContent value="budget_issued_transaction">
            <BudgetIssuedTransaction />
          </TabsContent>
        </div>
      </Tabs>

      <BudgetModal
        open={modalType !== null}
        transaction={modalType}
        create={create}
        employees={budgets}
        onClose={() => setModalType(null)}
      />
    </div>
  );
}
