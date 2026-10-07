import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import { Card } from "../../../ui/Card";
import { formatMoney } from "@/lib/utils";
import { EmployeeBudgetMetrics } from "./EmployeeBudgetMetrics";
import { EmployeeTraceChart } from "./EmployeeTraceChart";

export function EmployeeFundsPanel({
  issued,
  received,
  spent,
  sent,
  abono,
  traceData,
  traceLoading,
}) {
  const records = Array.isArray(traceData) ? traceData.length : 0;
  const latest = records > 0 ? traceData[records - 1] : null;
  const hasTrace = !traceLoading && records > 0;

  return (
    <Card padding="md" className="relative overflow-hidden">
      {/* Backdrop trace — the same running lines, faded to a watermark so
          the floating stats read as sitting on live data. Decorative only
          (pointer events off); the interactive chart below keeps hover. */}
      {hasTrace && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={traceData}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="bgIssued" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="bgSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--danger)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--danger)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="bgAbono" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--warning)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--warning)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey="cumIssued"
                stroke="none"
                fill="url(#bgIssued)"
                dot={{ r: 2.5, fill: "var(--accent)", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="cumSpent"
                stroke="none"
                fill="url(#bgSpent)"
                dot={{ r: 2.5, fill: "var(--danger)", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="cumAbono"
                stroke="none"
                fill="url(#bgAbono)"
                dot={{ r: 2.5, fill: "var(--warning)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {/* Readability veil — keeps tile text crisp over busy stretches. */}
          <div className="absolute inset-0 bg-[var(--surface)]/55 backdrop-blur-[1px]" />
        </div>
      )}

      {/* Floating stats + live strip */}
      <div className="relative">
        <EmployeeBudgetMetrics
          issued={issued}
          received={received}
          spent={spent}
          sent={sent}
          abono={abono}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 px-3.5 py-2 text-xs tabular-nums text-[var(--ink-muted)] shadow-card backdrop-blur">
          <span>
            Net flow{" "}
            <span className="font-medium text-[var(--ink)]">
              {formatMoney(issued + abono - spent)}
            </span>
          </span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span>
            {records} {records === 1 ? "record" : "records"} traced
          </span>
          {latest && (
            <>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <span>
                Latest{" "}
                <span className="font-medium text-[var(--ink)]">
                  {latest.kindLabel} · {formatMoney(latest.amount)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive trace — full hover details live here. */}
      <div className="relative mt-3 border-t border-[var(--border)] pt-3">
        <EmployeeTraceChart traceData={traceData} traceLoading={traceLoading} height={150} />
      </div>
    </Card>
  );
}

export default EmployeeFundsPanel;
