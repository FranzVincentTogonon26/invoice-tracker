import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  CircleX,
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
  const overviewExpenses = overview.overviewExpenses ?? [];
  const totalBudget = overview.totalBudget ?? 0;
  const totalIssued = overview.totalIssued ?? 0;
  const totalExpenses = overview.totalExpenses ?? 0;

  // Balance = total budget − (total issued + total expenses)
  const cashOnHand =
    Number(totalBudget) - (Number(totalIssued) + Number(totalExpenses));
  const cashOnHandNum = Number(cashOnHand) || 0;
  const totalBudgetAmt = Number(totalBudget) || 0;

  // Cent-rounded: money renders to 2dp, so anything that formats as ₱0.00
  // counts as depleted (avoids 0.004 slipping past a strict `=== 0` check).
  // Depleted only reads as a warning once there is an allocation to deplete —
  // an empty ledger (no budget yet) keeps the neutral card.
  const isOverdrawn = cashOnHandNum < -0.004;
  const isDepleted =
    !isOverdrawn && Math.abs(cashOnHandNum) < 0.005 && totalBudgetAmt > 0;

  const issuedByReference = new Map(
    overviewIssuedBudget.map((row) => [
      row.reference_id,
      Number(row.amount || 0),
    ]),
  );
  const expensesByReference = new Map(
    overviewExpenses.map((row) => [row.reference_id, Number(row.amount || 0)]),
  );
  // Per-reference remaining = allocated − issued − expenses (same formula as
  // the headline balance, just scoped to each budget source).
  const cashOnHandBreakdown = overviewBudget.map((row, i) => {
    const issued = issuedByReference.get(row.reference_id) ?? 0;
    const spent = expensesByReference.get(row.reference_id) ?? 0;
    const remaining = Number(row.amount || 0) - issued - spent;
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
  const totalExpensesNum = Number(totalExpenses) || 0;
  const utilization =
    totalBudgetNum > 0
      ? Math.min(
          100,
          ((totalIssuedNum + totalExpensesNum) / totalBudgetNum) * 100,
        )
      : 0;

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Budget"
        description="Allocate funds, issue to employees, and track every move."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
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
          className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
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
              label="My Balance"
              value={formatMoney(cashOnHand)}
              icon={PhilippinePesoIcon}
              loading={isLoading}
              tone={isOverdrawn ? "danger" : isDepleted ? "warning" : undefined}
              status={
                isOverdrawn
                  ? {
                      tone: "danger",
                      label: "Overdrawn — over budget",
                      icon: CircleX,
                    }
                  : isDepleted
                    ? {
                        tone: "warning",
                        label: "Depleted — no funds left",
                        icon: CircleAlert,
                      }
                    : undefined
              }
              breakdownCaption="Remaining"
              breakdown={cashOnHandBreakdown}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="My Expenses"
              value={formatMoney(totalExpenses)}
              icon={ReceiptText}
              loading={isLoading}
              breakdownCaption="Expenses"
              breakdown={overviewExpenses.map((row, i) => ({
                key: i,
                label: row.label ?? "Untitled reference",
                value: formatMoney(row.amount),
                hint: formatDate(row.created_at),
              }))}
            />
          </motion.div>

          <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
            <StatCard
              label="Total Issued"
              value={formatMoney(totalIssued)}
              icon={HandCoins}
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
                  Budget utilization
                </p>
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`font-display text-2xl font-semibold tracking-tight tabular-nums ${
                      Number(cashOnHand) < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {utilization.toFixed(1)}%
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    used
                  </span>
                  <span className="w-full text-sm text-[var(--ink-muted)] sm:w-auto">
                    {formatMoney(Number(totalIssued) + Number(totalExpenses))}{" "}
                    of {formatMoney(totalBudget)} allocated
                  </span>
                </p>
              </div>
              <Badge
                tone={
                  isOverdrawn ? "danger" : isDepleted ? "warning" : "accent"
                }
                className="w-fit shrink-0"
              >
                {isOverdrawn ? (
                  <CircleX size={12} />
                ) : isDepleted ? (
                  <CircleAlert size={12} />
                ) : (
                  <CircleCheck size={12} />
                )}{" "}
                Balance {formatMoney(cashOnHand)}
                {isDepleted && !isOverdrawn ? " — depleted" : ""}
                {isOverdrawn ? " — overdrawn" : ""}
              </Badge>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(utilization.toFixed(1))}
              aria-label="Share of budget already used"
              className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    Number(totalBudget) > 0
                      ? Math.min(
                          100,
                          (Number(totalIssued) / Number(totalBudget)) * 100,
                        )
                      : 0
                  }%`,
                }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.2,
                }}
                className="utilization-fill h-full shrink-0 rounded-l-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(
                    0,
                    utilization -
                      (Number(totalBudget) > 0
                        ? Math.min(
                            100,
                            (Number(totalIssued) / Number(totalBudget)) * 100,
                          )
                        : 0),
                  )}%`,
                }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.3,
                }}
                className="h-full shrink-0 rounded-r-full bg-[var(--warning)]/70"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--ink-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-[var(--accent)]"
                />
                Issued ·{" "}
                <span className="font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(totalIssued)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-[var(--warning)]/70"
                />
                My Expenses ·{" "}
                <span className="font-semibold tabular-nums text-[var(--ink)]">
                  {formatMoney(totalExpenses)}
                </span>
              </span>
              <span className="ml-auto tabular-nums">
                {overviewBudget.length}{" "}
                {overviewBudget.length === 1 ? "reference" : "references"} ·{" "}
                {overviewIssuedBudget.length} issued · {overviewExpenses.length}{" "}
                {overviewExpenses.length === 1 ? "expense" : "expenses"}
              </span>
            </div>
          </Card>
        </motion.div>
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
