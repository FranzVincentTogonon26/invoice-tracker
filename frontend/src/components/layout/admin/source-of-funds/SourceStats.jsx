import { motion } from "framer-motion";
import {
  HandCoins,
  PhilippinePesoIcon,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "../../../ui/StatCard";
import { formatMoney, toMoney } from "@/lib/utils";

export function SourceStats({ totals, sparks, isLoading }) {
  return (
    <motion.div
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.08, delayChildren: 0.02 },
        },
      }}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4"
    >
      {[
        {
          label: "Total Allocated",
          value: formatMoney(totals.allocated),
          icon: TrendingUp,
          accent: true,
          data: sparks.allocated,
          chart: "bars",
        },
        {
          label: "Total Remaining",
          value: formatMoney(totals.remaining),
          icon: PhilippinePesoIcon,
          data: sparks.remaining,
          chart: "bars",
        },
        {
          label: "Total Used",
          value: formatMoney(toMoney(totals.issued + totals.expenses)),
          icon: HandCoins,
          data: sparks.used,
          chart: "bars",
        },
        {
          label: "Transactions",
          value: totals.transactions.toLocaleString(),
          icon: Wallet,
          tone: "success",
          data: sparks.transactions,
          chart: "bars",
        },
      ].map((card) => (
        <motion.div
          key={card.label}
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            tone={card.tone}
            loading={isLoading}
            chart={card.chart}
            data={card.data}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default SourceStats;
