import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  BadgeCheck,
  CircleCheck,
  HandCoins,
  PhilippinePesoIcon,
  Plus,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";

import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

import { formatMoney, formatDate } from "../../lib/utils";
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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

const TAB_META = [
  { value: "employee_budget", label: "Employees", icon: Users },
  { value: "budget_transaction", label: "Transactions", icon: ReceiptText },
  { value: "budget_issued_transaction", label: "Issued", icon: ArrowLeftRight },
];

export default function AdminBudget() {
  const nav = useNavigate();
  const { data, isLoading } = useBudgets();
  const { create } = useBudgetMutations();
  const [modalType, setModalType] = useState(null);
  const [tab, setTab] = useState("employee_budget");

  const overview = data?.budgetOverview ?? {};
  const overviewBudget = overview.overviewBudget ?? [];
  const overviewIssuedBudget = overview.overviewIssuedBudget ?? [];
  const totalBudget = overview.totalBudget ?? 0;
  const totalIssued = overview.totalIssued ?? 0;
  const cashOnHand = totalBudget - totalIssued;

  const issuedByReference = new Map(
    overviewIssuedBudget.map((row) => [
      row.reference_id,
      Number(row.amount || 0),
    ]),
  );
  const cashOnHandBreakdown = overviewBudget.map((row, i) => {
    const issued = issuedByReference.get(row.reference_id) ?? 0;
    const remaining = Number(row.amount || 0) - issued;
    return {
      key: i,
      label: row.label ?? "Untitled reference",
      value: formatMoney(remaining),
      hint: formatDate(row.created_at),
      tone: remaining < 0 ? "danger" : undefined,
    };
  });

  const budgets = data?.employeeBudgets ?? [];
  const employees = data?.employees ?? [];
  const budgetReferences = data?.budgetReference ?? [];

  const totalBudgetNum = Number(totalBudget) || 0;
  const totalIssuedNum = Number(totalIssued) || 0;
  const utilization =
    totalBudgetNum > 0
      ? Math.min(100, (totalIssuedNum / totalBudgetNum) * 100)
      : 0;

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Budget"
        description="Allocate funds, issue to employees, and track every move."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button
              variant="soft"
              size="md"
              onClick={() => setModalType("addBudget")}
            >
              <Plus size={15} /> Add Budget
            </Button>
            <Button
              variant="accent"
              onClick={() => setModalType("issuedBudget")}
            >
              <HandCoins size={15} /> Issue Budget
            </Button>
          </div>
        }
      />

      <section aria-label="Budget overview" className="space-y-4">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 items-stretch gap-4 sm:gap-5 lg:grid-cols-3"
        >
          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Budget"
              value={formatMoney(totalBudget)}
              icon={TrendingUp}
              accent
              loading={isLoading}
              breakdownCaption="Allocated"
              breakdown={overviewBudget.map((row, i) => ({
                key: i,
                label: row.label ?? "Untitled reference",
                value: formatMoney(row.amount),
                hint: formatDate(row.created_at),
              }))}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="My Vault"
              value={formatMoney(cashOnHand)}
              icon={PhilippinePesoIcon}
              loading={isLoading}
              tone={Number(cashOnHand) < 0 ? "danger" : undefined}
              breakdownCaption="Remaining"
              breakdown={cashOnHandBreakdown}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Issued"
              value={formatMoney(totalIssued)}
              icon={BadgeCheck}
              loading={isLoading}
              breakdownCaption="Issued"
              breakdown={overviewIssuedBudget.map((row, i) => ({
                key: i,
                label: row.label ?? "Untitled reference",
                value: formatMoney(row.amount),
                hint: formatDate(row.created_at),
              }))}
            />
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          <Card radius="lg" padding="md" className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/60,transparent)]"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="type-eyebrow text-[var(--ink-muted)]">
                  Allocation utilization
                </p>
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-lg font-semibold tracking-tight text-[var(--ink)]">
                  {utilization.toFixed(1)}% issued
                  <span className="text-sm font-medium  text-[var(--ink-muted)]">
                    {formatMoney(totalIssued)} of {formatMoney(totalBudget)}
                  </span>
                </p>
              </div>
              <Badge tone="accent" className="w-fit shrink-0 ">
                <CircleCheck size={12} /> Vault {formatMoney(cashOnHand)}
              </Badge>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(utilization.toFixed(1))}
              aria-label="Share of budget already issued"
              className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${utilization}%` }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.2,
                }}
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-hero-2),var(--accent-hero))]"
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-[var(--ink-muted)]">
              <span className="shrink-0 tabular-nums">0%</span>
              <span className="min-w-0 truncate text-center tabular-nums">
                {overviewBudget.length}{" "}
                {overviewBudget.length === 1 ? "reference" : "references"} ·{" "}
                {overviewIssuedBudget.length} issued
              </span>
              <span className="shrink-0 tabular-nums">100%</span>
            </div>
          </Card>
        </motion.div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--success)]/20 bg-[var(--success)]/[0.06] px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--success)]/12 text-[var(--success)]">
            <CircleCheck size={16} />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink-muted)]">
            <span className="font-semibold text-[var(--ink)]">All clear</span>
            {" — no overdue budgets right now."}
          </p>
          <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(0)}
          </span>
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 py-1.5 backdrop-blur-sm md:-mx-1 md:px-1">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto sm:self-start">
              {TAB_META.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="grow px-2.5 sm:grow-0 sm:px-4"
                >
                  <Icon size={14} aria-hidden className="shrink-0" />
                  <span className="whitespace-nowrap">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="hidden shrink-0 pl-2 text-sm text-[var(--ink-muted)] lg:block">
              {tab === "employee_budget" &&
                "Click an employee to open profile."}
              {tab === "budget_transaction" && "Added + issued activity."}
              {tab === "budget_issued_transaction" &&
                "Every issuance handed out."}
            </p>
          </div>
        </div>

        <div>
          <TabsContent value="employee_budget">
            <EmployeeBudget
              employeeIssuedBudget={budgets}
              isLoading={isLoading}
              onOpen={(id) => nav(`/employee/${id}`)}
            />
          </TabsContent>
          <TabsContent value="budget_transaction">
            <BudgetTransaction valueRemaining={cashOnHand} />
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
