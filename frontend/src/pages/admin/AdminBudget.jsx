import {
  BadgeCheck,
  BadgeInfo,
  BadgeMinus,
  PhilippinePesoIcon,
  Plus,
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

export default function AdminBudget() {
  const [tab, setTab] = useState("employee_budget");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Manage and monitor your budget and transactions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="soft">
              <Plus size={16} /> Add Budget
            </Button>
            <Button variant="accent">Budget Issued</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6 ">
        <StatCard
          label="Total Budget"
          value={formatMoney(20000)}
          icon={PhilippinePesoIcon}
          accent
        />
        <StatCard
          label="Total Remaining"
          value={formatMoney(9000)}
          icon={BadgeCheck}
        />
        <StatCard
          label="Total Issued"
          value={formatMoney(10000)}
          icon={BadgeMinus}
        />

        <StatCard
          label="Overdue"
          value={5}
          suffix={formatMoney(1000)}
          icon={BadgeInfo}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employee_budget">Employee Budget</TabsTrigger>
          <TabsTrigger value="budget_transaction">
            Budget Transaction
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="employee_budget">
            <EmployeeBudget />
          </TabsContent>
          <TabsContent value="budget_transaction">
            <BudgetTransaction />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
