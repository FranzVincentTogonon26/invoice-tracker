import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import { cn, formatMoney } from "@/lib/utils";
import { TRANSACTION_KIND_META } from "@/constants";

const CHART_EASE = [0.16, 1, 0.3, 1];

const KIND_COLORS = {
  budget: "var(--ink)",
  issued: "var(--accent)",
  expense: "var(--warning)",
  abono: "var(--success)",
  transfer_sent: "var(--danger)",
  transfer_received: "var(--success)",
};

const shortDay = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fullDay = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Cumulative money-in vs money-out trajectory across the selected records,
// oldest first — the tracing view: how the pool filled and drained over
// time. Buckets one point per calendar day so long ranges stay readable.
function useTrajectory(rows) {
  return useMemo(() => {
    const sorted = [...(rows ?? [])].sort(
      (a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0),
    );
    const byDay = new Map();
    for (const row of sorted) {
      const day = new Date(row.date ?? 0);
      if (Number.isNaN(day.getTime())) continue;
      const key = day.toLocaleDateString("en-CA");
      const bucket = byDay.get(key) ?? { key, in: 0, out: 0 };
      bucket.in += Number(row.moneyIn) || 0;
      bucket.out += Number(row.moneyOut) || 0;
      byDay.set(key, bucket);
    }
    let cumIn = 0;
    let cumOut = 0;
    return [...byDay.values()].map((b) => {
      const dayIn = Math.round(b.in * 100) / 100;
      const dayOut = Math.round(b.out * 100) / 100;
      cumIn = Math.round((cumIn + dayIn) * 100) / 100;
      cumOut = Math.round((cumOut + dayOut) * 100) / 100;
      return {
        label: shortDay(b.key),
        fullDate: fullDay(b.key),
        in: cumIn,
        out: cumOut,
        net: Math.round((cumIn - cumOut) * 100) / 100,
        dayIn,
        dayOut,
      };
    });
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="min-w-[180px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-hover">
      <p className="text-[11px] font-medium text-[var(--ink-muted)]">
        {point.fullDate ?? point.label}
      </p>
      <div className="mt-1.5 space-y-1 text-xs">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: entry.color || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(entry.value)}
            </span>
          </div>
        ))}
        {point.dayIn != null && (
          <div className="border-t border-[var(--border)] pt-1 text-[11px] text-[var(--ink-muted)]">
            <div className="flex items-center justify-between gap-4">
              <span>That day in</span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(point.dayIn)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>That day out</span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(point.dayOut)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Exact-figure strip under the trajectory: range totals plus per-active-
// day averages so the curve reads as numbers, not just shape.
function TrajectoryStats({ trajectory = [] }) {
  const days = trajectory.length;
  const last = trajectory[days - 1];
  if (!last) return null;
  const avgIn = days > 0 ? last.in / days : 0;
  const avgOut = days > 0 ? last.out / days : 0;
  const stats = [
    ["Total in", formatMoney(last.in)],
    ["Total out", formatMoney(last.out)],
    ["Net", formatMoney(last.net)],
    ["Active days", String(days)],
    ["Avg in / day", formatMoney(avgIn)],
    ["Avg out / day", formatMoney(avgOut)],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            {label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Tracing charts for the selected report records: cumulative in-vs-out
// trajectory plus a per-kind comparison. Pure presentational — everything
// derives from the filtered rows the page already holds.
export function ReportTraceChart({ rows = [] }) {
  const [mode, setMode] = useState("flow");
  const trajectory = useTrajectory(rows);
  const kindTotals = useKindTotals(rows);
  const maxKind = Math.max(0, ...kindTotals.map((k) => k.amount));

  if ((rows ?? []).length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
            {mode === "flow" ? "Money Trajectory" : "Kind Comparison"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {mode === "flow"
              ? "Cumulative in vs out across the selected records"
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
        trajectory.length === 0 ? (
          <p className="mt-4 text-center text-xs text-[var(--ink-muted)]">
            No dated records to trace.
          </p>
        ) : (
          <>
          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trajectory}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${Math.round(v / 1000)}k`
                        : `${v}`
                  }
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="in"
                  name="Money in"
                  stroke="var(--success)"
                  fill="var(--success)"
                  fillOpacity={0.14}
                  strokeWidth={2}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  name="Money out"
                  stroke="var(--danger)"
                  fill="var(--danger)"
                  fillOpacity={0.14}
                  strokeWidth={2}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--accent)"
                  strokeDasharray="5 4"
                  fill="none"
                  strokeWidth={2}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <TrajectoryStats trajectory={trajectory} />
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
