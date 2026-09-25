import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleX,
  HandCoins,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useEmployeeOverview } from "../../hooks/useEmployeeOverview";
import { cn, formatMoney } from "../../lib/utils";
import { TransactionsSection } from "../../components/layout/employee/overview/TransactionsSection";

const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.02 } },
};

const card = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const MiniStat = ({ icon: Icon, label, value, loading, iconClass, title }) => (
  <div className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-5" title={title}>
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 sm:rounded-xl",
          iconClass,
        )}
      >
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <p className="type-eyebrow truncate text-[9px] text-[var(--ink-muted)] sm:text-[10px]">
        {label}
      </p>
    </div>
    {loading ? (
      <div className="mt-2.5 h-5 w-16 animate-pulse rounded-md bg-[var(--surface-2)] sm:w-20" />
    ) : (
      <p className="mt-2 truncate font-display text-[13px] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)] sm:text-[19px]">
        {value}
      </p>
    )}
  </div>
);

const EmployeeOverview = () => {
  const { data, isLoading } = useEmployeeOverview();
  const totalBudget = Number(data?.totalBudget) || 0;
  const totalExpenses = Number(data?.totalExpenses) || 0;
  const totalAbono = Number(data?.totalAbono) || 0;
  const totalBalance = Number(data?.totalBalance) || 0;
  const expenseCount = Number(data?.expenseCount) || 0;
  const transactions = data?.transactions ?? [];

  const isOverdrawn = !isLoading && totalBalance < -0.004;
  const isDepleted =
    !isLoading &&
    !isOverdrawn &&
    Math.abs(totalBalance) < 0.005 &&
    totalBudget + totalAbono > 0;

  const funded = totalBudget + totalAbono;
  const share =
    funded > 0 ? Math.max(0, Math.min(1, totalBalance / funded)) : 0;
  const spentPct = Math.round((1 - share) * 100);

  const StatusIcon = isOverdrawn ? CircleX : CircleAlert;
  const showStatus = !isLoading && (isOverdrawn || isDepleted);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header — desktop only, mobile uses its own compact title */}

      <PageHeader title="Overview" description="Your money at a glance." />

      {/* ── Finance overview — one hero + three essentials ── */}
      <section aria-label="Budget overview">
        <motion.div
          variants={grid}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:gap-4"
        >
          {/* Remaining Balance — the hero of the page */}
          <motion.div
            variants={card}
            className={cn(
              "relative overflow-hidden rounded-[24px] p-5 text-white shadow-card sm:rounded-[28px] sm:p-7",
              "border border-transparent bg-[var(--accent-hero)]",
              "bg-[image:linear-gradient(135deg,var(--accent-hero-2)_0%,var(--accent-hero)_58%,var(--accent-hero)_100%)]",
              isOverdrawn &&
                "bg-[image:linear-gradient(135deg,#f43f5e_0%,#9f1239_70%)]",
              isDepleted &&
                !isOverdrawn &&
                "bg-[image:linear-gradient(135deg,#f59e0b_0%,#92400e_75%)]",
            )}
          >
            {/* finance glow + watermark */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22)_0%,transparent_65%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-10 -right-8 select-none font-display text-[120px] font-bold leading-none tracking-tighter text-white/[0.07] sm:text-[168px]"
            >
              ₱
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-white/15"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20"
            />

            <div className="relative flex items-center gap-2">
              <span className="type-eyebrow text-[10px] tracking-[0.18em] text-white/65 sm:text-[11px]">
                Available balance
              </span>
              {showStatus && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold leading-none text-[var(--ink)]">
                  <StatusIcon
                    size={12}
                    className={
                      isOverdrawn
                        ? "text-[var(--danger)]"
                        : "text-[var(--warning)]"
                    }
                  />
                  {isOverdrawn ? "Overdrawn" : "Depleted"}
                </span>
              )}
            </div>

            {isLoading ? (
              <>
                <div className="relative mt-3 h-10 w-44 animate-pulse rounded-xl bg-white/20 sm:h-12 sm:w-64" />
                <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-white/30" />
                </div>
              </>
            ) : (
              <>
                <p className="relative mt-3 font-display text-[34px] font-semibold leading-none tracking-tight tabular-nums sm:text-[44px]">
                  {formatMoney(totalBalance)}
                </p>
                {/* utilization — spent share of everything funded */}
                {funded > 0 && (
                  <div className="relative mt-4 max-w-md">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${spentPct}%` }}
                        transition={{
                          duration: 0.7,
                          ease: [0.16, 1, 0.3, 1],
                          delay: 0.25,
                        }}
                        className="h-full rounded-full bg-white/90"
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-none text-white/65 tabular-nums sm:text-xs">
                      {spentPct}% spent
                      {expenseCount > 0
                        ? ` · ${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"}`
                        : ""}
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Essentials — one strip, three figures. No sub-labels. */}
          <motion.div
            variants={card}
            className="grid grid-cols-3 divide-x divide-[var(--border)] rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-card sm:rounded-[24px]"
          >
            <MiniStat
              icon={Wallet}
              label="Budget"
              value={formatMoney(totalBudget)}
              loading={isLoading}
              title={formatMoney(totalBudget)}
              iconClass="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            />
            <MiniStat
              icon={ReceiptText}
              label="Spent"
              value={formatMoney(totalExpenses)}
              loading={isLoading}
              title={formatMoney(totalExpenses)}
              iconClass="bg-[var(--danger)]/10 text-[var(--danger)]"
            />
            <MiniStat
              icon={HandCoins}
              label="Abono"
              value={formatMoney(totalAbono)}
              loading={isLoading}
              title={formatMoney(totalAbono)}
              iconClass="bg-[var(--warning)]/12 text-[var(--warning)]"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ── ALL TRANSACTIONS CARD ── */}
      <motion.div
        variants={card}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.15 }}
      >
        <TransactionsSection
          transactions={transactions}
          isLoading={isLoading}
        />
      </motion.div>
    </div>
  );
};

export default EmployeeOverview;
