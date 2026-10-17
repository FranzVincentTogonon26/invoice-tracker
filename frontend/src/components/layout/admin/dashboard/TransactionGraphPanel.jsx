import { useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
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
import { Card } from "../../../ui/Card";
import { useSocketStatus } from "../../../../hooks/useRealtime";
import {
  cn,
  formatMoney,
} from "../../../../lib/utils";
import { ALL_SOURCES, CHART_EASE, compactPeso, SERIES } from "../../../../lib/dashboard";

/* ── Right panel: per-transaction line graph with floating chrome ─────── */

export default function TransactionGraphPanel({
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

  // Legend chips: legs can be muted to de-clutter or read a single curve —
  // the guard keeps at least one money leg on so the scale stays honest.
  // The dashed pool line has its own chip.
  const [muted, setMuted] = useState(() => new Set());
  const [showNet, setShowNet] = useState(true);
  const visibleSeries = SERIES.filter((s) => !muted.has(s.key));

  const toggleSeries = (key) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        const legsOn = SERIES.reduce(
          (n, s) => n - (next.has(s.key) ? 1 : 0),
          SERIES.length,
        );
        if (legsOn > 1) next.add(key);
      }
      return next;
    });

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
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--border)] px-6 py-5 text-center">
              <Activity
                size={20}
                className="text-[var(--ink-muted)]"
                aria-hidden
              />
              <p className="text-sm text-[var(--ink-muted)]">
                No transactions recorded for this scope yet.
              </p>
              <p className="text-[11px] text-[var(--ink-muted)] opacity-70">
                Budget in, issued hands, expenses and abono appear here live.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
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
                content={
                  <MovementTooltip mutedKeys={muted} showNet={showNet} />
                }
              />
              {visibleSeries.map((s, i) => (
                // The crisp pin-pointed line over its gradient wash —
                // staggered draw-in per leg, one dot per transaction.
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
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
              {showNet && (
                // The remaining pool as a quiet dashed read — the line the
                // dashboard exists for: allocation + abono − everything out.
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
        )}
      </motion.div>

      {/* Floating header — title + subline on the left, legend chips on the
          right; the subline swaps to the hovered transaction, terminal-style */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
              Transactions Overview
            </h3>
            <span
              title={
                live
                  ? "Realtime updates connected"
                  : "Live updates reconnecting"
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

        {/* Legend chips — toggle legs on/off, keep the scale honest */}
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          {SERIES.map((s) => {
            const on = !muted.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                aria-pressed={on}
                title={on ? `Hide ${s.label}` : `Show ${s.label}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm transition-colors",
                  on
                    ? "border-[var(--border)] bg-[var(--surface-2)]/85 text-[var(--ink)] hover:bg-[var(--surface-2)]"
                    : "border-dashed border-[var(--border)] bg-[var(--surface)]/40 text-[var(--ink-muted)] hover:text-[var(--ink)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    on ? "" : "ring-1 ring-inset ring-[var(--ink-muted)]",
                  )}
                  style={{ backgroundColor: on ? s.color : "transparent" }}
                />
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowNet((v) => !v)}
            aria-pressed={showNet}
            title={showNet ? "Hide net pool" : "Show net pool"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm transition-colors",
              showNet
                ? "border-[var(--border)] bg-[var(--surface-2)]/85 text-[var(--ink)] hover:bg-[var(--surface-2)]"
                : "border-dashed border-[var(--border)] bg-[var(--surface)]/40 text-[var(--ink-muted)] hover:text-[var(--ink)]",
            )}
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
      </div>
    </Card>
  );
}

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
        {SERIES.filter((s) => !mutedSet.has(s.key)).map(
          ({ key, label, color }) => (
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
          ),
        )}
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
