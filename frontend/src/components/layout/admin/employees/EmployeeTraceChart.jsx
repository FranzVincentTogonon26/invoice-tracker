import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/utils";

/** Per-point tooltip for the trace chart — date, triggering record + the
 * three running totals for direct comparison. */
function TraceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const lines = [
    { label: "Issued total", value: point.cumIssued, dot: "bg-[var(--accent)]" },
    { label: "Spent total", value: point.cumSpent, dot: "bg-[var(--danger)]" },
    { label: "Abono total", value: point.cumAbono, dot: "bg-[var(--warning)]" },
  ];
  return (
    <div className="min-w-[190px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-hover">
      <p className="text-xs font-medium tabular-nums text-[var(--ink-muted)]">
        {point.fullDate}
      </p>
      <p className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
          <span aria-hidden className={`h-2 w-2 rounded-full ${point.dot}`} />
          {point.kindLabel}
          {point.status ? ` · ${point.status}` : ""}
        </span>
        <span className="font-medium tabular-nums text-[var(--ink)]">
          {point.signed}
          {formatMoney(point.amount)}
        </span>
      </p>
      <div className="mt-1.5 space-y-1 border-t border-[var(--border)] pt-1.5">
        {lines.map((line) => (
          <p
            key={line.label}
            className="flex items-center justify-between gap-3 text-xs tabular-nums"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <span aria-hidden className={`h-2 w-2 rounded-full ${line.dot}`} />
              {line.label}
            </span>
            <span className="font-medium text-[var(--ink)]">
              {formatMoney(line.value)}
            </span>
          </p>
        ))}
      </div>
      {point.title && (
        <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">
          {point.title}
        </p>
      )}
    </div>
  );
}

export function EmployeeTraceChart({ traceData, traceLoading, height = 190 }) {
  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-medium tracking-tight text-[var(--ink)]">
            Balance trace
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Running totals per kind — hover any point to compare.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-xs text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-[var(--accent)]"
            />
            Issued
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-[var(--danger)]"
            />
            Spent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-[var(--warning)]"
            />
            Abono
          </span>
        </div>
      </div>
      {traceLoading ? (
        <div
          className="animate-pulse rounded-2xl bg-[var(--surface-2)]"
          style={{ height }}
        />
      ) : traceData.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
          No transactions to trace yet.
        </p>
      ) : (
          <div className="px-1 sm:px-2">
            <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={traceData}
              margin={{ top: 10, right: 8, bottom: 0, left: -10 }}
            >
              <defs>
                <linearGradient id="trIssued" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="trSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--danger)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--danger)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="trAbono" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--warning)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--warning)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 100) / 10}k` : v
                }
              />
              <Tooltip
                content={<TraceTooltip />}
                cursor={{ stroke: "var(--border)" }}
              />
              <Area
                type="monotone"
                dataKey="cumIssued"
                name="Issued"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#trIssued)"
                dot={{ r: 3, fill: "var(--accent-strong)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--accent-strong)" }}
              />
              <Area
                type="monotone"
                dataKey="cumSpent"
                name="Spent"
                stroke="var(--danger)"
                strokeWidth={2.5}
                fill="url(#trSpent)"
                dot={{ r: 3, fill: "var(--danger)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--danger)" }}
              />
              <Area
                type="monotone"
                dataKey="cumAbono"
                name="Abono"
                stroke="var(--warning)"
                strokeWidth={2.5}
                fill="url(#trAbono)"
                dot={{ r: 3, fill: "var(--warning)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--warning)" }}
              />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
    </>
  );
}

export default EmployeeTraceChart;
