import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleX,
  ClipboardList,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "../../../ui/StatCard";
import { formatMoney } from "@/lib/utils";
import { AbonoStatCard } from "./AbonoStatCard";

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
  inSeries,
  cashOnHand,
  isBalanceOverdrawn,
  isBalanceDepleted,
  balanceStats,
  abono,
  abonoSeries,
  recordCount,
  recordSeries,
  recordStats,
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
            label="Money In"
            value={formatMoney(totals.moneyIn)}
            icon={TrendingUp}
            loading={isLoading}
            accent
            chart="bars"
            data={inSeries}
            stats={[
              {
                key: "given",
                label: "Budget Given",
                value: formatMoney(totals.given),
                hint: `${totals.givenSources} ${
                  totals.givenSources === 1 ? "source" : "sources"
                }`,
              },
            ]}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Fund Balance"
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
          <AbonoStatCard
            isLoading={isLoading}
            openTotal={abono.openTotal}
            openCount={abono.openCount}
            employees={abono.employees}
            series={abonoSeries}
          />
        </motion.div>

        <motion.div variants={item} className="h-full min-w-0 [&>div]:h-full">
          <StatCard
            label="Abono Records"
            value={recordCount}
            icon={ClipboardList}
            loading={isLoading}
            chart="bars"
            data={recordSeries}
            stats={recordStats}
          />
        </motion.div>
      </motion.div>

      <p className="px-1 text-xs text-[var(--ink-muted)]">
        Fund-pool view — Money In counts live budget allocations only · Fund
        Balance is Budget Given − Issued − Open Abono · Settled abono was
        reimbursed and no longer funds the pool · Rows under a cut-off source
        leave no footsteps anywhere on this page
      </p>
    </section>
  );
}

export default ReimbursementOverview;
