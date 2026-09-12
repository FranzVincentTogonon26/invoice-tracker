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
import { useNavigate } from "react-router-dom";
import { useBudgets, useBudgetMutations } from "../../hooks/useBudget";
import EmployeeBudget from "../../components/layout/admin/budget/EmployeeBudget";
import BudgetTransaction from "../../components/layout/admin/budget/BudgetTransaction";
import BudgetModal from "../../components/layout/admin/budget/BudgetModal";
import BudgetIssuedTransaction from "../../components/layout/admin/budget/BudgetIssuedTransaction";

export default function AdminBudget() {
  const nav = useNavigate();
  const { data, isLoading } = useBudgets();
  const { create } = useBudgetMutations();
  const [modalType, setModalType] = useState(null);
  const [tab, setTab] = useState("employee_budget");

  // const overview = data?.budgetOverview ?? [];
  const budgets = data?.employeeBudgets ?? [];
  const employees = data?.employees ?? [];
  const budgetReferences = data?.budgetReference ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Manage and monitor your budget and transactions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="soft" onClick={() => setModalType("addBudget")}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Budget"
          value={formatMoney(10000)}
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
          value={formatMoney(10000)}
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
        <TabsList className="max-w-full overflow-x-auto">
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
        employees={employees}
        budgetReferences={budgetReferences}
        onClose={() => setModalType(null)}
      />
    </div>
  );
}
