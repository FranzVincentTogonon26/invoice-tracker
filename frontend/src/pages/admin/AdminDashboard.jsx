import { useEffect, useMemo, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import {
  Activity,
  HandCoins,
  Inbox,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState } from "../../components/ui/DataState";
import Listbox from "../../components/ui/Listbox";
import { useSourceFunds } from "../../hooks/useSourceFunds";
import { useTransactions } from "../../hooks/useTransactions";
import { useSocketStatus } from "../../hooks/useRealtime";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  toMoney,
} from "../../lib/utils";

const CHART_EASE = [0.16, 1, 0.3, 1];

const ALL_SOURCES = "all";

// Series palette — one theme token per money leg, reused by the chart, the
// stat strip and the tooltip so the four figures stay identifiable.
const SERIES = [
  {
    key: "cumAllocated",
    totalKey: "allocated",
    label: "Allocated",
    color: "var(--accent)",
    Icon: Plus,
    footer: "Total budget in",
    pick: (row) => (row.kind === "budget" ? Number(row.moneyIn) || 0 : 0),
  },
  {
    key: "cumIssued",
    totalKey: "issued",
    label: "Issued",
    color: "var(--warning)",
    Icon: HandCoins,
    footer: "Handed out",
    pick: (row) => (row.kind === "issued" ? Number(row.moneyOut) || 0 : 0),
  },
  {
    key: "cumSpent",
    totalKey: "spent",
    label: "Spent",
    color: "var(--danger)",
    Icon: ReceiptText,
    footer: "Expenses logged",
    pick: (row) => (row.kind === "expense" ? Number(row.moneyOut) || 0 : 0),
  },
  {
    key: "cumAbono",
    totalKey: "abono",
    label: "Abono",
    color: "var(--success)",
    Icon: Wallet,
    footer: "Returns recorded",
    pick: (row) => (row.kind === "abono" ? Number(row.moneyIn) || 0 : 0),
  },
];

// Compact peso ticks keep long figures from crowding the axis edge.
const compactPeso = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toFixed(0)}`;
};

const shortDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const AdminDashboard = () => {
  const [selected, setSelected] = useState(ALL_SOURCES);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Both queries live under the realtime bridge (["budgets"] / ["transactions"]
  // are invalidated on every money event), so the panel and the graph stream
  // in new figures without a manual refresh.
  const {
    sources,
    isLoading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
  } = useSourceFunds();
  const {
    transactions,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useTransactions();

  const openSources = useMemo(
    () => (sources ?? []).filter((s) => (s.status ?? "open") === "open"),
    [sources],
  );

  // The picker only ever offers open sources; a selection that was closed or
  // deleted while viewing falls back to the combined view instead of breaking.
  const activeId = openSources.some((s) => s.reference_id === selected)
    ? selected
    : ALL_SOURCES;
  const activeSource =
    activeId === ALL_SOURCES
      ? null
      : (openSources.find((s) => s.reference_id === activeId) ?? null);

  // Rows inside the selected scope: the four money legs of OPEN sources only —
  // transfers are employee-to-employee moves that never touch the pool.
  const scopeRows = useMemo(() => {
    const rows = (transactions ?? []).filter((row) => {
      if (!["budget", "issued", "expense", "abono"].includes(row.kind))
        return false;
      if (!row.referenceId) return false;
      return activeId === ALL_SOURCES
        ? openSources.some((s) => s.reference_id === row.referenceId)
        : row.referenceId === activeId;
    });
    return rows.sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));
  }, [transactions, activeId, openSources]);

  // Headline totals — equal to the last point's cumulative values, so the
  // stat strip always agrees with the chart.
  const totals = useMemo(
    () =>
      scopeRows.reduce(
        (acc, row) => ({
          allocated: acc.allocated + SERIES[0].pick(row),
          issued: acc.issued + SERIES[1].pick(row),
          spent: acc.spent + SERIES[2].pick(row),
          abono: acc.abono + SERIES[3].pick(row),
        }),
        { allocated: 0, issued: 0, spent: 0, abono: 0 },
      ),
    [scopeRows],
  );

  // One point PER TRANSACTION — every money movement pins a dot on each leg's
  // line, so the graph doubles as a map of the ledger: hover any point to
  // read the transaction and the running figures at that exact moment.
  const chartData = useMemo(() => {
    const running = { allocated: 0, issued: 0, spent: 0, abono: 0 };
    return scopeRows.map((row) => {
      running.allocated += SERIES[0].pick(row);
      running.issued += SERIES[1].pick(row);
      running.spent += SERIES[2].pick(row);
      running.abono += SERIES[3].pick(row);
      const cumAllocated = toMoney(running.allocated);
      const cumIssued = toMoney(running.issued);
      const cumSpent = toMoney(running.spent);
      const cumAbono = toMoney(running.abono);
      return {
        ts: new Date(row.date).getTime(),
        label: shortDay(row.date),
        fullDate: `${formatDate(row.date)} · ${formatTime(row.date)}`,
        title: row.description || "Transaction",
        amount: Number(row.amount) || 0,
        signed: row.direction === "in" ? "+" : "−",
        cumAllocated,
        cumIssued,
        cumSpent,
        cumAbono,
        net: toMoney(cumAllocated + cumAbono - cumIssued - cumSpent),
      };
    });
  }, [scopeRows]);

  // Hover-driven stat strip: the cards act like an exchange ticker, showing
  // the crossed transaction's figures and falling back to the live totals
  // when the cursor leaves the chart.
  const hoverPoint =
    hoverIndex != null &&
    Number.isInteger(hoverIndex) &&
    chartData[hoverIndex] != null
      ? chartData[hoverIndex]
      : null;
  const readout = hoverPoint ?? null;

  const totalNet = toMoney(
    totals.allocated + totals.abono - totals.issued - totals.spent,
  );

  const remainingTotal = useMemo(
    () =>
      toMoney(
        openSources.reduce((sum, s) => sum + (Number(s.remaining) || 0), 0),
      ),
    [openSources],
  );

  // Composition of the pool for the hero breakdown bar — what happened to the
  // open sources' money: handed out, spent, or still sitting as balance.
  const flow = useMemo(
    () =>
      openSources.reduce(
        (acc, s) => ({
          issued: acc.issued + (Number(s.issued) || 0),
          spent: acc.spent + (Number(s.expenses) || 0),
          remaining: acc.remaining + Math.max(Number(s.remaining) || 0, 0),
        }),
        { issued: 0, spent: 0, remaining: 0 },
      ),
    [openSources],
  );

  const isLoading = sourcesLoading || txLoading;
  const hasError = Boolean(sourcesError || txError);

  const sourceOptions = useMemo(
    () => [
      { value: ALL_SOURCES, label: "All Sources" },
      ...openSources.map((s) => ({ value: s.reference_id, label: s.label })),
    ],
    [openSources],
  );

  // Stat-strip figures: live totals normally, the hovered point's running
  // figures while the crosshair is active.
  const stats = [
    ...SERIES.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      Icon: s.Icon,
      footer: s.footer,
      value: readout ? readout[s.key] : totals[s.totalKey],
    })),
    {
      key: "net",
      label: "Net Pool",
      color: (readout ? readout.net : totalNet) >= 0 ? "var(--success)" : "var(--danger)",
      Icon: Activity,
      footer: "Allocated + abono − out",
      value: readout ? readout.net : totalNet,
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Dashboard"
        description="Live remaining balance and money movement across your open budget sources."
        actions={
          <div className="w-full sm:w-52">
            <Listbox
              portal
              searchable={sourceOptions.length > 8}
              options={sourceOptions}
              value={activeId}
              onChange={setSelected}
              placeholder="Select source"
            />
          </div>
        }
      />

      {hasError ? (
        <Card padding="none">
          <ErrorState
            title="Couldn't load the dashboard"
            message="The budget figures or the transaction ledger failed to load."
            onRetry={() => {
              if (sourcesError) refetchSources();
              if (txError) refetchTx();
            }}
          />
        </Card>
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : openSources.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Inbox}
            title="No open budget sources"
            message="Create a source of funds and add budgets to see the live balance and movement graph here."
          />
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {/* ── Stat strip — live totals that follow the chart crosshair ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat, i) => (
              <StatCard
                key={stat.key}
                index={i}
                label={stat.label}
                value={stat.value}
                color={stat.color}
                Icon={stat.Icon}
                footer={stat.footer}
                inspecting={Boolean(readout)}
                className={i === stats.length - 1 ? "col-span-2 sm:col-span-1" : ""}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
            {/* ── Left (~25%): remaining balance for open sources ── */}
            <div className="lg:col-span-3">
              <RemainingPanel
                total={remainingTotal}
                flow={flow}
                sources={openSources}
                selected={activeId}
                onSelect={setSelected}
              />
            </div>

            {/* ── Right (~75%): live line graph pinned per transaction ── */}
            <div className="lg:col-span-9">
              <TransactionGraphPanel
                activeId={activeId}
                activeSource={activeSource}
                windowData={chartData}
                hoverPoint={hoverPoint}
                onHover={setHoverIndex}
                onHoverEnd={() => setHoverIndex(null)}
                rowCount={scopeRows.length}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Money that springs between values — count-up on mount, quick roll on
      live updates and crosshair moves (exchange-ticker feel). ──────────── */

function AnimatedMoney({ value, className, snappy = false }) {
  const spring = useSpring(0, snappy
    ? { stiffness: 190, damping: 26, mass: 0.5 }
    : { stiffness: 80, damping: 21, mass: 0.9 });
  const text = useTransform(spring, (v) => formatMoney(v));

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [spring, value]);

  return <motion.span className={className}>{text}</motion.span>;
}

/* ── Stat card — icon tile + live figure + context line ───────────────── */

function StatCard({ label, value, color, Icon, footer, inspecting, className, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: CHART_EASE, delay: 0.06 * index }}
      className={cn(
        "rounded-2xl border bg-[var(--surface)] p-3 shadow-card transition-colors duration-300",
        inspecting ? "border-[var(--accent)]/40" : "border-[var(--border)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            color,
            backgroundColor: "color-mix(in srgb, currentColor 12%, transparent)",
          }}
        >
          <Icon size={13} />
        </span>
        {inspecting && (
          <span className="relative flex h-2 w-2" title="Showing the hovered transaction">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </span>
        )}
      </div>
      <p className="type-eyebrow mt-2.5 truncate text-[var(--ink-muted)]">
        {label}
      </p>
      <AnimatedMoney
        snappy
        value={value}
        className={cn(
          "mt-0.5 block truncate font-display text-base font-semibold tabular-nums sm:text-lg",
          label === "Net Pool" &&
            (value >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"),
        )}
      />
      <p className="mt-0.5 truncate text-[10px] text-[var(--ink-muted)]">
        {footer}
      </p>
    </motion.div>
  );
}

/* ── Left panel: remaining hero + per-source utilization rows ─────────── */

function RemainingPanel({ total, flow, sources, selected, onSelect }) {
  const flowTotal = flow.issued + flow.spent + flow.remaining;
  const segments = [
    { key: "issued", label: "Issued", value: flow.issued, color: "var(--warning)" },
    { key: "spent", label: "Spent", value: flow.spent, color: "var(--danger)" },
    {
      key: "remaining",
      label: "Balance",
      value: flow.remaining,
      color: "rgba(255, 255, 255, 0.45)",
    },
  ];

  return (
    <Card
      padding="lg"
      radius="lg"
      className="flex h-full flex-col overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: CHART_EASE }}
        className="rounded-2xl bg-[image:linear-gradient(135deg,var(--accent-hero-2)_0%,var(--accent-hero)_60%,var(--accent-hero)_100%)] px-5 py-6 text-white shadow-card"
      >
        <p className="type-eyebrow text-white/60">Remaining Balance</p>
        <AnimatedMoney
          value={total}
          className="mt-2 block break-words font-display text-3xl font-medium tracking-tight tabular-nums xl:text-4xl"
        />
        <p className="mt-2 text-xs text-white/70">
          Across {sources.length} open{" "}
          {sources.length === 1 ? "source" : "sources"} of funds
        </p>

        {/* Pool composition — where the money went or still sits */}
        {flowTotal > 0 && (
          <>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/15">
              {segments.map((seg, i) => (
                <motion.span
                  key={seg.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${(seg.value / flowTotal) * 100}%` }}
                  transition={{ duration: 0.9, ease: CHART_EASE, delay: 0.25 + i * 0.12 }}
                  className="h-full"
                  style={{ backgroundColor: seg.color }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/70">
              {segments.map((seg) => (
                <span key={seg.key} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  {seg.label}
                </span>
              ))}
            </div>
          </>
        )}
      </motion.div>

      <div className="mt-4 flex items-center justify-between px-1">
        <span className="type-eyebrow text-[var(--ink-muted)]">
          Open Sources
        </span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--ink-muted)]">
          {sources.length}
        </span>
      </div>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
        }}
        aria-label="Open budget sources and their remaining balance"
        className="scrollbar-inline mt-2 max-h-96 flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[420px]"
      >
        {sources.map((source) => {
          const isSelected = selected === source.reference_id;
          const allocated = Number(source.allocated) || 0;
          const used =
            (Number(source.issued) || 0) + (Number(source.expenses) || 0);
          const hasBudget = allocated > 0;
          const pct = hasBudget ? Math.min(100, (used / allocated) * 100) : 0;
          const barColor =
            pct >= 90
              ? "var(--danger)"
              : pct >= 60
                ? "var(--warning)"
                : "var(--accent)";
          return (
            <motion.li
              key={source.reference_id}
              variants={{
                hidden: { opacity: 0, x: -10 },
                show: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.3, ease: CHART_EASE },
                },
              }}
            >
              <button
                type="button"
                onClick={() =>
                  onSelect(isSelected ? ALL_SOURCES : source.reference_id)
                }
                aria-pressed={isSelected}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                  isSelected
                    ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] shadow-card"
                    : "border-[var(--border)] bg-[var(--surface-2)]/40 hover:-translate-y-px hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)] hover:shadow-card",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
                    {source.label || "Untitled source"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-display text-sm font-semibold tabular-nums",
                      Number(source.remaining) < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--accent-strong)]",
                    )}
                  >
                    {formatMoney(source.remaining)}
                  </span>
                </span>

                <span className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-[var(--ink-muted)]">
                  <span className="min-w-0 truncate">
                    {hasBudget
                      ? `${formatMoney(used)} used of ${formatMoney(allocated)}`
                      : "No allocation yet"}
                  </span>
                  {hasBudget && (
                    <span className="shrink-0 tabular-nums">
                      {Math.round(pct)}%
                    </span>
                  )}
                </span>

                {hasBudget && (
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--ink)]/5">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: CHART_EASE, delay: 0.15 }}
                      className="block h-full rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </Card>
  );
}

/* ── Right panel: per-transaction line graph with floating chrome ─────── */

function TransactionGraphPanel({
  activeId,
  activeSource,
  windowData,
  hoverPoint,
  onHover,
  onHoverEnd,
  rowCount,
}) {
  const status = useSocketStatus();
  const live = status === "connected";
  const scopeLabel =
    activeId === ALL_SOURCES
      ? "All open sources combined"
      : (activeSource?.label ?? "Source");

  // Shared hover probe — recharts 3 reports the crossed datum through
  // `activeTooltipIndex`, which feeds the stat strip and the crosshair.
  const trackHover = (state) => {
    if (!state?.isTooltipActive) {
      onHoverEnd();
      return;
    }
    const idx = Number(state.activeTooltipIndex);
    if (Number.isInteger(idx)) onHover(idx);
  };

  // Pin-point dots — one per transaction, with a pulsing ring on the newest
  // point marking the "live edge" of each curve. SMIL keeps the ring
  // radiating without transform-origin issues on SVG.
  const pointDot = (color) => {
    const lastIndex = windowData.length - 1;
    return ({ cx, cy, index }) => {
      if (cx == null || cy == null) return null;
      const isLast = index === lastIndex;
      return (
        <g key={`pt-${index}`}>
          {isLast && (
            <circle cx={cx} cy={cy} r={4} fill={color}>
              <animate
                attributeName="r"
                values="4;11"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.45;0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle
            cx={cx}
            cy={cy}
            r={2}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={1}
          />
        </g>
      );
    };
  };

  return (
    <Card
      padding="none"
      radius="lg"
      className="relative h-full min-h-[420px] overflow-hidden"
    >
      {/* Chart layer — fills the whole card; the chrome floats above it */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CHART_EASE, delay: 0.15 }}
        className="absolute inset-0 p-2"
      >
        {windowData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--ink-muted)]">
            No transactions recorded for this scope yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={windowData}
              margin={{ top: 52, right: 8, bottom: 2, left: 4 }}
              onMouseMove={trackHover}
              onMouseLeave={onHoverEnd}
              onTouchMove={trackHover}
              onTouchEnd={onHoverEnd}
            >
              {/* Soft gradient wash under each leg — modern chart depth
                  without hiding the crisp stroke on top. `style` is used
                  because CSS variables don't resolve in SVG attributes. */}
              <defs>
                {SERIES.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`dash-wash-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      style={{ stopColor: s.color, stopOpacity: 0.24 }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: s.color, stopOpacity: 0 }}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={40}
              />
              {/* Money axis on the right, like an exchange chart */}
              <YAxis
                orientation="right"
                width={54}
                tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={compactPeso}
              />
              <Tooltip
                cursor={{
                  stroke: "var(--accent)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.6,
                }}
                content={<MovementTooltip />}
              />
              {SERIES.map((s, i) => (
                // The crisp pin-pointed line over its gradient wash —
                // staggered draw-in per leg, one dot per transaction.
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  fill={`url(#dash-wash-${s.key})`}
                  fillOpacity={1}
                  dot={pointDot(s.color)}
                  activeDot={{
                    r: 4.5,
                    strokeWidth: 2,
                    stroke: "var(--surface)",
                    fill: s.color,
                  }}
                  animationBegin={180 + i * 140}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Floating title + live badge — the subline swaps to the hovered
          transaction, terminal-style */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
        <div className="flex items-center gap-2.5">
          <h3 className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
            Money Movement
          </h3>
          <span
            title={
              live ? "Realtime updates connected" : "Live updates reconnecting"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              live
                ? "bg-[var(--success)]/12 text-[var(--success)]"
                : "bg-[var(--surface-2)] text-[var(--ink-muted)]",
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  live ? "bg-[var(--success)]" : "bg-[var(--ink-muted)]",
                )}
              />
            </span>
            {live ? "Live" : "Connecting"}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 truncate text-xs",
            hoverPoint
              ? "text-[var(--accent-strong)]"
              : "text-[var(--ink-muted)]",
          )}
        >
          {hoverPoint
            ? `${hoverPoint.fullDate} · ${hoverPoint.title} · ${hoverPoint.signed}${formatMoney(hoverPoint.amount)}`
            : `${scopeLabel} · ${rowCount} ${rowCount === 1 ? "transaction" : "transactions"}`}
        </p>
      </div>
    </Card>
  );
}

function MovementTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: CHART_EASE }}
      className="pointer-events-none min-w-[230px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-hover"
    >
      <div className="border-b border-[var(--border)] pb-2">
        <p className="text-[11px] font-semibold text-[var(--ink)]">
          {point.fullDate}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
          {point.title}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">
            {point.signed}
            {formatMoney(point.amount)}
          </span>
        </p>
      </div>
      <div className="mt-2 space-y-1.5 text-xs">
        {SERIES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </span>
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(point[key])}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-2 text-xs">
        <span className="text-[var(--ink-muted)]">Net pool</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            point.net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}
        >
          {formatMoney(point.net)}
        </span>
      </div>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[104px] animate-pulse rounded-2xl bg-[var(--surface-2)]",
              i === 4 && "col-span-2 sm:col-span-1",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
        <div className="lg:col-span-9">
          <div className="h-[420px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
