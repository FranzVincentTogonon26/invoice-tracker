import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import { cn, formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { KIND_COLORS, moneyOutOf } from "@/lib/reports";
import { TRANSACTION_KIND_META } from "@/constants";
import { CHART_EASE, SERIES, compactPeso, shortDay } from "@/lib/dashboard";

// The movement graph mirrors the dashboard's Transactions Overview: one
// point per money-moving record, four cumulative legs and the dashed net
// pool, staggered draw-in, a pulsing live edge and a hover probe that
// reads the crossed transaction. The one data tweak against the
// dashboard's legs is Spent — reports count a paid expense only when it
// sits on the books (admin-side, or an employee row tagged to a source),
// so the curve agrees with the page's Money-out card.
const LEGS = SERIES.map((serie) => ({
  ...serie,
  pick: serie.key === "cumSpent" ? (row) => moneyOutOf(row) : serie.pick,
}));

// One point per transaction, oldest first — every money movement pins a
// dot on each leg's line, so the graph doubles as a map of the ledger.
// Transfer legs and zero-amount rows never touch the pool: no dot.
function useMovement(rows) {
  return useMemo(() => {
    const sorted = [...(rows ?? [])].sort(
      (a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0),
    );
    const running = { cumAllocated: 0, cumIssued: 0, cumSpent: 0, cumAbono: 0 };
    const points = [];
    for (const row of sorted) {
      const steps = LEGS.map((leg) => Number(leg.pick(row)) || 0);
      if (!steps.some((step) => step > 0)) continue;
      LEGS.forEach((leg, index) => {
        running[leg.key] = toMoney(running[leg.key] + steps[index]);
      });
      const date = new Date(row.date ?? 0);
      points.push({
        dayKey: Number.isNaN(date.getTime())
          ? ""
          : date.toLocaleDateString("en-CA"),
        label: shortDay(row.date),
        fullDate: `${formatDate(row.date)} · ${formatTime(row.date)}`,
        title:
          row.description ||
          TRANSACTION_KIND_META[row.kind]?.label ||
          "Transaction",
        amount: Number(row.amount) || 0,
        signed: row.direction === "in" ? "+" : "−",
        ...running,
        net: toMoney(
          running.cumAllocated +
            running.cumAbono -
            running.cumIssued -
            running.cumSpent,
        ),
      });
    }
    return { points, days: new Set(points.map((point) => point.dayKey)).size };
  }, [rows]);
}

// Total moved per transaction kind — compares where money came from and
// where it went across the selected records.
function useKindTotals(rows) {
  return useMemo(() => {
    const totals = new Map();
    for (const row of rows ?? []) {
      const amount = (Number(row.moneyIn) || 0) + (Number(row.moneyOut) || 0);
      if (amount <= 0) continue;
      const entry = totals.get(row.kind) ?? { amount: 0, count: 0 };
      entry.amount += amount;
      entry.count += 1;
      totals.set(row.kind, entry);
    }
    return [...totals.entries()].map(([kind, entry]) => ({
      kind,
      label: TRANSACTION_KIND_META[kind]?.label ?? kind ?? "—",
      amount: Math.round(entry.amount * 100) / 100,
      count: entry.count,
      color: KIND_COLORS[kind] ?? "var(--accent)",
    }));
  }, [rows]);
}

// Hover card for the crossed transaction: what it was, then every leg's
// running figure at that exact moment plus the net pool.
function MovementTooltip({ active, payload, mutedKeys, showNet }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const mutedSet = mutedKeys ?? new Set();
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
        {LEGS.filter((leg) => !mutedSet.has(leg.key)).map((leg) => (
          <div key={leg.key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: leg.color }}
              />
              {leg.label}
            </span>
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(point[leg.key])}
            </span>
          </div>
        ))}
      </div>
      {showNet && (
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
      )}
    </motion.div>
  );
}

// Exact-figure strip under the graph: every leg's closing total, the net
// pool and how many days actually moved money.
function MovementStats({ points, days }) {
  const last = points[points.length - 1];
  if (!last) return null;
  const tiles = [
    ...LEGS.map((leg) => ({
      label: leg.label,
      value: formatMoney(last[leg.key]),
      color: leg.color,
    })),
    { label: "Net pool", value: formatMoney(last.net) },
    { label: "Active days", value: String(days) },
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            {tile.color ? (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tile.color }}
              />
            ) : null}
            {tile.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Movement analysis for the selected report records: the per-transaction
// money-leg trajectory (same language as the dashboard's Transactions
// Overview) plus a per-kind comparison. Pure presentational — everything
// derives from the filtered rows the page already holds.
export function ReportTraceChart({ rows = [] }) {
  const [mode, setMode] = useState("flow");
  const [hoverIndex, setHoverIndex] = useState(null);
  const [muted, setMuted] = useState(() => new Set());
  const [showNet, setShowNet] = useState(true);
  const { points, days } = useMovement(rows);
  const kindTotals = useKindTotals(rows);
  const maxKind = Math.max(0, ...kindTotals.map((k) => k.amount));

  if ((rows ?? []).length === 0) return null;

  const visibleLegs = LEGS.filter((leg) => !muted.has(leg.key));
  const hoverPoint = Number.isInteger(hoverIndex)
    ? (points[hoverIndex] ?? null)
    : null;

  // Recharts 3 reports the crossed datum through `activeTooltipIndex`,
  // which feeds the header readout and the crosshair.
  const trackHover = (state) => {
    if (!state?.isTooltipActive) {
      setHoverIndex(null);
      return;
    }
    const idx = Number(state.activeTooltipIndex);
    if (Number.isInteger(idx)) setHoverIndex(idx);
  };

  // Legend chips: legs can be muted to read a single curve — the guard
  // keeps at least one money leg on so the scale stays honest.
  const toggleLeg = (key) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (LEGS.length - next.size > 1) {
        next.add(key);
      }
      return next;
    });

  // Pin-point dots — one per money movement, with a pulsing ring on the
  // newest point marking the live edge of each curve. SMIL keeps the ring
  // radiating without transform-origin issues on SVG.
  const pointDot = (color) => {
    const lastIndex = points.length - 1;
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

  const chipClass = (on) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
      on
        ? "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
        : "border-dashed border-[var(--border)] bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]",
    );

  return (
    <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
            {mode === "flow" ? "Money Trajectory" : "Kind Comparison"}
          </p>
          {/* The subline swaps to the hovered transaction, terminal-style */}
          <p
            className={cn(
              "mt-0.5 truncate text-xs transition-colors",
              hoverPoint && mode === "flow"
                ? "text-[var(--accent-strong)]"
                : "text-[var(--ink-muted)]",
            )}
          >
            {mode === "flow"
              ? hoverPoint
                ? `${hoverPoint.fullDate} · ${hoverPoint.title} · ${hoverPoint.signed}${formatMoney(hoverPoint.amount)}`
                : "Running money legs across the selected records"
              : "Total moved per transaction kind"}
          </p>
        </div>
        <div className="inline-flex self-start rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs sm:self-auto">
          {[
            ["flow", "Trajectory"],
            ["kinds", "By kind"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "rounded-lg px-2.5 py-1 font-medium transition-all",
                mode === value
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "flow" ? (
        points.length === 0 ? (
          <p className="mt-4 text-center text-xs text-[var(--ink-muted)]">
            No money movement in the selected records.
          </p>
        ) : (
          <>
            {/* Legend chips — toggle legs on/off, keep the scale honest */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {LEGS.map((leg) => {
                const on = !muted.has(leg.key);
                return (
                  <button
                    key={leg.key}
                    type="button"
                    onClick={() => toggleLeg(leg.key)}
                    aria-pressed={on}
                    title={on ? `Hide ${leg.label}` : `Show ${leg.label}`}
                    className={chipClass(on)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-all",
                        on ? "" : "ring-1 ring-inset ring-[var(--ink-muted)]",
                      )}
                      style={{ backgroundColor: on ? leg.color : "transparent" }}
                    />
                    {leg.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowNet((value) => !value)}
                aria-pressed={showNet}
                title={showNet ? "Hide net pool" : "Show net pool"}
                className={chipClass(showNet)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    showNet ? "" : "ring-1 ring-inset ring-[var(--ink-muted)]",
                  )}
                  style={{
                    backgroundColor: showNet ? "var(--ink)" : "transparent",
                  }}
                />
                Net
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: CHART_EASE, delay: 0.08 }}
              className="mt-3 h-[240px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={points}
                  margin={{ top: 8, right: 6, bottom: 0, left: 6 }}
                  onMouseMove={trackHover}
                  onMouseLeave={() => setHoverIndex(null)}
                  onTouchMove={trackHover}
                  onTouchEnd={() => setHoverIndex(null)}
                >
                  {/* Soft gradient wash under each leg — chart depth
                      without hiding the crisp stroke on top. `style` is
                      used because CSS variables don't resolve in SVG
                      attributes. */}
                  <defs>
                    {LEGS.map((leg) => (
                      <linearGradient
                        key={leg.key}
                        id={`rt-wash-${leg.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          style={{ stopColor: leg.color, stopOpacity: 0.22 }}
                        />
                        <stop
                          offset="100%"
                          style={{ stopColor: leg.color, stopOpacity: 0 }}
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
                    padding={{ left: 12, right: 12 }}
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
                    content={
                      <MovementTooltip mutedKeys={muted} showNet={showNet} />
                    }
                  />
                  {visibleLegs.map((leg, index) => (
                    // The crisp pin-pointed line over its gradient wash —
                    // staggered draw-in per leg, one dot per transaction.
                    <Area
                      key={leg.key}
                      type="monotone"
                      dataKey={leg.key}
                      name={leg.label}
                      stroke={leg.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      fill={`url(#rt-wash-${leg.key})`}
                      fillOpacity={1}
                      dot={pointDot(leg.color)}
                      activeDot={{
                        r: 4.5,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: leg.color,
                      }}
                      animationBegin={180 + index * 140}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    />
                  ))}
                  {showNet && (
                    // The remaining pool as a quiet dashed read —
                    // allocated + abono − everything out.
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net pool"
                      stroke="var(--ink)"
                      strokeOpacity={0.5}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                      activeDot={{
                        r: 3,
                        strokeWidth: 2,
                        stroke: "var(--surface)",
                        fill: "var(--ink)",
                      }}
                      animationBegin={700}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>

            <MovementStats points={points} days={days} />
          </>
        )
      ) : kindTotals.length === 0 ? (
        <p className="mt-4 text-center text-xs text-[var(--ink-muted)]">
          Nothing moved in the selected records.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {kindTotals.map((k, i) => {
            const share =
              maxKind > 0 ? Math.round((k.amount / maxKind) * 100) : 0;
            return (
              <div key={k.kind}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--ink-muted)]">
                    {k.label}{" "}
                    <span className="tabular-nums opacity-70">
                      · {k.count} {k.count === 1 ? "record" : "records"} ·{" "}
                      {share}%
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
                    {formatMoney(k.amount)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    maxKind > 0 ? Math.round((k.amount / maxKind) * 100) : 0
                  }
                  aria-label={`${k.label} share of movement`}
                  className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${maxKind > 0 ? (k.amount / maxKind) * 100 : 0}%`,
                    }}
                    transition={{
                      duration: 0.6,
                      ease: CHART_EASE,
                      delay: 0.05 * i,
                    }}
                    className="h-full rounded-full"
                    style={{ background: k.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReportTraceChart;
