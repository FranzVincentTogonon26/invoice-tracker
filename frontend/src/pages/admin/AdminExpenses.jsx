import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { motion } from "framer-motion";
import { StatCard } from "../../components/ui/StatCard";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { monthRange } from "../../lib/utils";
import { useNavigate } from "react-router-dom";

const AdminExpenses = () => {
  const nav = useNavigate();
  const [dateRange, setDateRange] = useState(() => monthRange());

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        title="Expenses"
        description="Track and manage all your expenses. Keep your budget on track and stay informed with real-time updates."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              align="end"
            />
            <Button variant="accent" onClick={() => nav("/admin/expenses/add")}>
              <Plus size={15} /> Add Expense
            </Button>
          </div>
        }
      />

      {/* Overview */}

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
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard label="Total Expenses" value={""} icon={""} loading={""} />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard label="This Month" value={""} icon={""} loading={""} />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Remaining Budget"
            value={""}
            icon={""}
            loading={""}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Total Transactions"
            value={""}
            icon={""}
            loading={""}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminExpenses;
