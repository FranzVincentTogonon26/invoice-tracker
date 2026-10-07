import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  ClipboardList,
  Plus,
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

export function TransactionOverview({
  isLoading,
  totals,
  inSeries,
  outSeries,
  countSeries,
  recordCount,
  kindCounts,
}) {
  return (
    <section aria-label="Transactions overview">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
      >
        <motion.div variants={item} className="min-w-0 [&>div]:h-full">
          <StatCard
            label="Money In"
            value={formatMoney(totals.moneyIn)}
            icon={Plus}
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
              {
                key: "abono",
                label: "Abono",
                value: formatMoney(totals.abonoIn),
                hint: `${totals.abonoCount} ${
                  totals.abonoCount === 1 ? "abono" : "abonos"
                }`,
              },
            ]}
          />
        </motion.div>
        <motion.div variants={item} className="min-w-0 [&>div]:h-full">
          <StatCard
            label="Money Out"
            value={formatMoney(totals.moneyOut)}
            icon={ArrowLeftRight}
            loading={isLoading}
            tone="danger"
            chart="bars"
            data={outSeries}
            stats={[
              {
                key: "issued",
                label: "Total Issued",
                value: formatMoney(totals.issued),
                hint: `${totals.issuedCount} issued`,
              },
              {
                key: "spent",
                label: "Expenses",
                value: formatMoney(totals.spent),
                hint: `${totals.spentCount} ${
                  totals.spentCount === 1 ? "expense" : "expenses"
                }`,
              },
            ]}
          />
        </motion.div>
        <motion.div
          variants={item}
          className="min-w-0 sm:col-span-2 xl:col-span-1 [&>div]:h-full"
        >
          <StatCard
            label="Records"
            value={recordCount}
            icon={ClipboardList}
            loading={isLoading}
            chart="bars"
            data={countSeries}
            stats={[
              {
                key: "given-count",
                label: "Budget Added",
                value: kindCounts.budget ?? 0,
              },
              {
                key: "expense-count",
                label: "Expenses",
                value: kindCounts.expense ?? 0,
              },
              {
                key: "transfer-count",
                label: "Transfers",
                value:
                  (kindCounts.transfer_sent ?? 0) +
                  (kindCounts.transfer_received ?? 0),
              },
            ]}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

export default TransactionOverview;
