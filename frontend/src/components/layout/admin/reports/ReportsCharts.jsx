import { motion } from "framer-motion";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatMoney } from "@/lib/utils";
import { CHART_EASE, compactPeso } from "@/lib/dashboard";

/* ── Charts for AdminReports ──────────────────────────────────────────────
   Presentational chart set shared by the page panels and the report preview
   modal. Everything derives from already-computed breakdowns (lib/reports.js)
   and follows the house chart language: CSS-variable colors, dashed
   CartesianGrid, 600–900ms ease-out entrances and hand-rolled motion bars
   where recharts would be overkill. */

// Shared tooltip card — same chrome as ReportTraceChart's ChartTooltip.
function ChartTip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null;
  const title =
    payload[0]?.payload?.fullLabel ??
    payload[0]?.payload?.name ??
    payload[0]?.name ??
    label;
  return (
    <div className="min-w-[170px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-hover">
      {title != null && title !== "" && (
        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
          {title}
        </p>
      )}
      <div className="mt-1.5 space-y-1 text-xs">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey ?? entry.name)}
            className="flex items-center justify-between gap-4"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    entry.payload?.fill ?? entry.color ?? entry.fill,
                }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-[var(--ink)]">
              {money ? formatMoney(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny inline key so the in/out/net colors read without hovering.
function FlowLegend({ className }) {
  return (
    <div
      className={cn(
        "mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-muted)]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--success)]" />
        Money in
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--danger)]" />
        Money out
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-3.5 rounded-full bg-[var(--accent)]"
          style={{ backgroundImage: "repeating-linear-gradient(90deg,var(--accent) 0 4px,transparent 4px 7px)" }}
        />
        Net
      </span>
    </div>
  );
}

// Monthly money in/out bars with a net line — the Financial Summary preview.
export function MonthlyFlowChart({ data = [], height = 220, className }) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
        No dated records to chart.
      </p>
    );
  }
  return (
    <div className={className}>
      <FlowLegend />
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={compactPeso}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<ChartTip />}
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
            />
            <Bar
              dataKey="in"
              name="Money in"
              fill="var(--success)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="out"
              name="Money out"
              fill="var(--danger)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="var(--accent)"
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Donut + ranked legend for paid spending by category.
export function CategoryDonut({
  items = [],
  centerLabel = "Paid spend",
  centerValue,
  className,
}) {
  const shown = (items ?? []).filter((item) => item.total > 0);
  if (shown.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-[var(--ink-muted)]">
        No paid expenses in the current view.
      </p>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTip />} />
            <Pie
              data={shown}
              dataKey="total"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {shown.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="type-eyebrow">{centerLabel}</span>
          <span className="mt-0.5 font-display text-base font-medium tabular-nums tracking-tight text-[var(--ink)]">
            {centerValue}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 self-stretch">
        {shown.slice(0, 6).map((item, index) => (
          <motion.li
            key={item.key}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: CHART_EASE, delay: 0.05 * index }}
            className="flex items-center gap-2 text-xs"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--ink-muted)]">
              {item.name}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
              {formatMoney(item.total)}
            </span>
            <span className="w-11 shrink-0 text-right tabular-nums text-[var(--ink-muted)]">
              {item.share}%
            </span>
          </motion.li>
        ))}
        {shown.length > 6 && (
          <li className="pl-[18px] text-xs text-[var(--ink-muted)]">
            +{shown.length - 6} more
          </li>
        )}
      </ul>
    </div>
  );
}

// Ranked horizontal bars — top spenders, events by action, any "biggest
// first" list. Colors fall back to the accent token.
export function SimpleBars({
  items = [],
  formatValue = formatMoney,
  emptyText = "Nothing to rank in this view.",
  className,
}) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
        {emptyText}
      </p>
    );
  }
  const max = Math.max(0, ...items.map((item) => Number(item.value) || 0));
  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item, index) => {
        const width =
          max > 0 ? ((Number(item.value) || 0) / max) * 100 : 0;
        return (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-[var(--ink-muted)]">
                <span className="font-medium text-[var(--ink)]">
                  {item.label}
                </span>
                {item.hint ? (
                  <span className="tabular-nums opacity-80"> · {item.hint}</span>
                ) : null}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
                {formatValue(item.value)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(width)}
              aria-label={`${item.label} relative size`}
              className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{
                  duration: 0.6,
                  ease: CHART_EASE,
                  delay: 0.05 * index,
                }}
                className="h-full rounded-full"
                style={{ background: item.color ?? "var(--accent)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Per-source deployment bars: issued + spent against allocated, with the
// remaining balance called out on each row.
export function UtilizationBars({
  items = [],
  emptyText = "No sources of funds yet.",
  className,
}) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
        {emptyText}
      </p>
    );
  }
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((source, index) => {
        const width = Math.max(0, Math.min(source.utilization, 100));
        const tone =
          source.utilization > 100
            ? "var(--danger)"
            : source.utilization >= 80
              ? "var(--warning)"
              : "var(--accent)";
        return (
          <motion.div
            key={source.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: CHART_EASE, delay: 0.04 * index }}
          >
            {/* Wrap-tolerant row: at narrow panel widths the money/deployed
                figures fall to their own right-aligned line instead of
                squeezing the label out of existence. */}
            <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-[var(--ink)]">
                  {source.label}
                </span>
                <span
                  className="hidden shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex"
                  style={{
                    color:
                      source.status === "open"
                        ? "var(--success)"
                        : "var(--danger)",
                    background:
                      source.status === "open"
                        ? "color-mix(in srgb, var(--success) 12%, transparent)"
                        : "color-mix(in srgb, var(--danger) 12%, transparent)",
                  }}
                >
                  {source.statusLabel}
                </span>
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-[var(--ink-muted)]">
                <span className="font-medium text-[var(--ink)]">
                  {formatMoney(source.remaining)}
                </span>{" "}
                left ·{" "}
                <span className="font-medium" style={{ color: tone }}>
                  {source.utilization}%
                </span>{" "}
                deployed
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(width)}
              aria-label={`${source.label} deployed ${source.utilization}%`}
              className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border)]"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{
                  duration: 0.7,
                  ease: CHART_EASE,
                  delay: 0.05 * index,
                }}
                className="h-full rounded-full"
                style={{ background: tone }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
