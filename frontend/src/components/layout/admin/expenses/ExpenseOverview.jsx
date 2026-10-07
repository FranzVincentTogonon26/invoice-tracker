import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleX,
  ClipboardList,
  HandCoins,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { StatCard } from "../../../ui/StatCard";
import { formatMoney } from "@/lib/utils";

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

export function ExpenseOverview({
  isLoading,
  totalSpend,
  spendSeries,
  heroStats,
  cashOnHand,
  isBalanceOverdrawn,
  isBalanceDepleted,
  balanceStats,
  totalIssued,
  issuedStats,
  recordCount,
  recordSeries,
  statusStats,
  flaggedCount,
}) {
  return (
    <section aria-label="Expenses overview" className="space-y-4">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
      >
        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Total Expenses"
            value={formatMoney(totalSpend)}
            icon={ReceiptText}
            loading={isLoading}
            accent
            chart="bars"
            data={spendSeries}
            stats={heroStats}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="My Balance"
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
            stats={balanceStats}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Total Issued Budget"
            value={formatMoney(totalIssued)}
            icon={HandCoins}
            loading={isLoading}
            stats={issuedStats}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Total Expenses Transactions"
            value={recordCount}
            icon={ClipboardList}
            loading={isLoading}
            chart="bars"
            data={recordSeries}
            stats={statusStats}
            status={
              flaggedCount > 0
                ? {
                    tone: "danger",
                    label:
                      flaggedCount === 1 ? "1 flag" : `${flaggedCount} flag`,
                  }
                : undefined
            }
          />
        </motion.div>
      </motion.div>

      <p className="px-1 text-xs text-[var(--ink-muted)]">
        Money figures — My Balance, Spent, Total Expenses, Avg / day and the
        ledger footer total — count admin spend only: cancelled lines and
        employee rows are excluded (employee spend is drawn from the budget
        already issued to them) · Total Expenses adds open budget issuances to
        expenses · Transactions counts every expense row, cancelled and
        employee included · The overview cards above are always all-time —
        charts and Avg / day span the records from first to last, and the date
        range only filters the table below
      </p>
    </section>
  );
}

export default ExpenseOverview;
