import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleX,
  HandCoins,
  PhilippinePesoIcon,
  ReceiptText,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { useEmployeeOverview } from "../../hooks/useEmployeeOverview";
import { formatMoney } from "../../lib/utils";
import { TransactionsSection } from "./TransactionsSection";

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

const StatTile = ({ children }) => (
  <motion.div
    variants={card}
    whileHover={{ y: -2 }}
    transition={{ type: "spring", stiffness: 380, damping: 28 }}
    className="h-full [&>div]:h-full"
  >
    {children}
  </motion.div>
);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const EmployeeOverview = () => {
  const { data, isLoading } = useEmployeeOverview();
  const totalBudget = Number(data?.totalBudget) || 0;
  const totalExpenses = Number(data?.totalExpenses) || 0;
  const totalAbono = Number(data?.totalAbono) || 0;
  const totalBalance = Number(data?.totalBalance) || 0;
  const activeReferences = Number(data?.activeReferences) || 0;
  const expenseCount = Number(data?.expenseCount) || 0;
  const abonoCount = Number(data?.abonoCount) || 0;
  const transactions = data?.transactions ?? [];

  const isOverdrawn = !isLoading && totalBalance < -0.004;
  const isDepleted =
    !isLoading &&
    !isOverdrawn &&
    Math.abs(totalBalance) < 0.005 &&
    totalBudget + totalAbono > 0;

  return (
    <div className="space-y-5">
      {/* Header — desktop only, mobile uses its own compact title */}
      <div className="hidden sm:block">
        <PageHeader
          title="Overview"
          description="Monitor your assigned budget, expenses and reimbursements."
        />
      </div>

      {/* ── 4 CARDS — same on mobile and desktop, just layout shifts ── */}
      {/* Mobile: 2 × 2 grid, balanced and readable */}
      <motion.div
        variants={grid}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:hidden"
        aria-label="Budget overview"
      >
        {/* Remaining Balance — accent to give life */}
        <motion.div
          variants={card}
          className="col-span-2 relative overflow-hidden rounded-[24px] border border-transparent bg-[var(--accent-hero)] bg-[image:linear-gradient(135deg,var(--accent-hero-2)_0%,var(--accent-hero)_60%)] p-4 text-white shadow-card"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full border border-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15"
          />
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white">
              <PhilippinePesoIcon size={16} />
            </span>
            <span className="type-eyebrow text-[10px] tracking-[0.13em] text-white/70">
              Remaining Balance
            </span>
            {!isLoading && (isOverdrawn || isDepleted) && (
              <span
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold leading-none ${
                  isOverdrawn
                    ? "bg-white text-[var(--danger)]"
                    : "bg-white text-[var(--warning)]"
                }`}
              >
                {isOverdrawn ? (
                  <CircleX size={11} />
                ) : (
                  <CircleAlert size={11} />
                )}
                {isOverdrawn ? "Overdrawn" : "Depleted"}
              </span>
            )}
          </div>

          {isLoading ? (
            <>
              <div className="mt-3 h-8 w-32 animate-pulse rounded-lg bg-white/20" />
              <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/15" />
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums">
                {formatMoney(totalBalance)}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                Budget + Abono − Expenses
              </p>
            </>
          )}
        </motion.div>

        {/* Budget Issued */}
        <motion.div
          variants={card}
          className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--accent-soft)]/50 to-transparent"
          />
          <div className="relative">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Wallet size={16} />
            </span>
            <p className="mt-3 type-eyebrow text-[10px] text-[var(--ink-muted)]">
              Budget Issued
            </p>
            {isLoading ? (
              <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            ) : (
              <p className="mt-1 font-display text-[16px] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                {formatMoney(totalBudget)}
              </p>
            )}
            <p className="mt-1 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
              {isLoading ? (
                <span className="inline-block h-3 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
              ) : activeReferences > 0 ? (
                `${plural(activeReferences, "open ref", "open refs")}`
              ) : (
                "No open refs"
              )}
            </p>
          </div>
        </motion.div>

        {/* Total Expenses */}
        <motion.div
          variants={card}
          className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
        >
          <div className="relative">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <ReceiptText size={16} />
            </span>
            <p className="mt-3 type-eyebrow text-[10px] text-[var(--ink-muted)]">
              Total Expenses
            </p>
            {isLoading ? (
              <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            ) : (
              <p className="mt-1 font-display text-[16px] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                {formatMoney(totalExpenses)}
              </p>
            )}
            <p className="mt-1 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
              {isLoading ? (
                <span className="inline-block h-3 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
              ) : expenseCount > 0 ? (
                `${plural(expenseCount, "transaction", "transactions")}`
              ) : (
                "No expenses"
              )}
            </p>
          </div>
        </motion.div>

        {/* Total Abono — spans full width on mobile for balance */}
        <motion.div
          variants={card}
          className="col-span-2 flex items-center gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:col-span-1 sm:flex-col sm:items-start"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--warning)]/12 text-[var(--warning)]">
            <HandCoins size={16} />
          </span>
          <div className="min-w-0 flex-1 sm:w-full">
            <p className="type-eyebrow text-[10px] text-[var(--ink-muted)]">
              Total Abono
            </p>
            {isLoading ? (
              <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            ) : (
              <p className="mt-1 font-display text-[16px] font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                {formatMoney(totalAbono)}
              </p>
            )}
            <p className="mt-1 text-[11px] font-medium leading-none text-[var(--ink-muted)]">
              {isLoading ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
              ) : abonoCount > 0 ? (
                `${plural(abonoCount, "reimbursement", "reimbursements")}`
              ) : (
                "No abono yet"
              )}
            </p>
          </div>
          <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] sm:flex">
            <ArrowUpRight size={14} />
          </span>
        </motion.div>
      </motion.div>

      {/* Desktop: 4 up — uses StatCard for consistency */}
      <section aria-label="Budget overview" className="hidden sm:block">
        <motion.div
          variants={grid}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 xl:grid-cols-4 xl:gap-5"
        >
          <StatTile>
            <StatCard
              label="Remaining Balance"
              value={formatMoney(totalBalance)}
              icon={PhilippinePesoIcon}
              accent
              loading={isLoading}
              tone={isOverdrawn ? "danger" : isDepleted ? "warning" : undefined}
              status={
                isOverdrawn
                  ? { tone: "danger", label: "Overdrawn", icon: CircleX }
                  : isDepleted
                    ? { tone: "warning", label: "Depleted", icon: CircleAlert }
                    : undefined
              }
              breakdownCaption="Budget + Abono − Expenses"
            />
          </StatTile>

          <StatTile>
            <StatCard
              label="Budget Issued"
              value={formatMoney(totalBudget)}
              icon={Wallet}
              loading={isLoading}
              breakdownCaption={
                activeReferences > 0
                  ? `${plural(activeReferences, "open ref", "open refs")}`
                  : "No open refs yet"
              }
            />
          </StatTile>

          <StatTile>
            <StatCard
              label="Total Expenses"
              value={formatMoney(totalExpenses)}
              icon={ReceiptText}
              loading={isLoading}
              breakdownCaption={
                expenseCount > 0
                  ? `${plural(expenseCount, "transaction", "transactions")}`
                  : "No expenses yet"
              }
            />
          </StatTile>

          <StatTile>
            <StatCard
              label="Total Abono"
              value={formatMoney(totalAbono)}
              icon={HandCoins}
              loading={isLoading}
              breakdownCaption={
                abonoCount > 0
                  ? `${plural(abonoCount, "reimbursement", "reimbursements")}`
                  : "No abono yet"
              }
            />
          </StatTile>
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
