import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleX,
  ClipboardList,
  PhilippinePeso,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { StatCard } from "../../../ui/StatCard";
import { formatDate, formatMoney } from "@/lib/utils";

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

export function ReimbursementOverview({
  isLoading,
  totals,
  givenBreakdown = [],
  cashOnHand,
  isBalanceOverdrawn,
  isBalanceDepleted,
  cashOnHandBreakdown = [],
  totalSpend,
  expensesSummary = [],
  openTotal,
  reimbursementRows = [],
}) {
  return (
    <section aria-label="Reimbursement overview" className="space-y-4">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
      >
        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Total Budget Allocated"
            value={formatMoney(totals.moneyIn)}
            icon={PhilippinePeso}
            accent
            loading={isLoading}
            breakdownCaption="Allocated"
            breakdown={givenBreakdown.map((row, i) => ({
              key: row.reference_id ?? i,
              label: row.label ?? "Untitled reference",
              value: formatMoney(row.amount),
              hint: formatDate(row.created_at),
            }))}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Remaining Balance"
            value={formatMoney(cashOnHand)}
            icon={Wallet}
            loading={isLoading}
            tone={
              isBalanceOverdrawn
                ? "danger"
                : isBalanceDepleted
                  ? "warning"
                  : undefined
            }
            status={
              isBalanceOverdrawn
                ? {
                    tone: "danger",
                    label: "Overdrawn — over budget",
                    icon: CircleX,
                  }
                : isBalanceDepleted
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
            label="Total Expenses"
            value={formatMoney(totalSpend)}
            icon={ReceiptText}
            loading={isLoading}
            breakdownCaption="Summary"
            breakdown={expensesSummary}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Total Abono"
            value={formatMoney(openTotal)}
            icon={ClipboardList}
            loading={isLoading}
            breakdownCaption="Reimbursements"
            breakdown={reimbursementRows}
          />
        </motion.div>
      </motion.div>

      <p className="px-1 text-xs text-[var(--ink-muted)]">
        Fund-pool view — Money In counts live budget allocations only · My
        Balance is Budget Given − Issued − Spent (same as Expenses → My Balance)
        · Expenses Summary hero matches Expenses → Total Expenses (Issued +
        admin Spent); its Total Spent row adds all-personnel spend on top ·
        Settled abono was reimbursed and no longer funds the pool · Rows under a
        cut-off source leave no footsteps anywhere on this page
      </p>
    </section>
  );
}

export default ReimbursementOverview;
