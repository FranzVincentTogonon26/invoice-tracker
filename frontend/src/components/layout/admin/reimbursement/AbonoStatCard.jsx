import { HandCoins } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card } from "../../../ui/Card";
import { StatCard } from "../../../ui/StatCard";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { formatMoney } from "@/lib/utils";

const MAX_STACK = 6;

// Third reimbursement card: open abono held by employees. StatCard has no
// avatar slot, so this is a bespoke accent card in the same visual language
// (icon tile, hero value, mini bars, stat strip) with an overlapping avatar
// stack of the employees holding open abono beneath the stats.
export function AbonoStatCard({
  isLoading,
  openTotal,
  openCount,
  employees = [],
  series = [],
}) {
  // Same skeleton as the sibling StatCards while loading.
  if (isLoading) {
    return (
      <StatCard
        label="Open Abono"
        value={formatMoney(openTotal)}
        icon={HandCoins}
        loading
        accent
        chart="bars"
        data={series}
      />
    );
  }
  const stack = employees.slice(0, MAX_STACK);
  const overflow = employees.length - stack.length;
  const stackTitle = employees.map((e) => e.name).join(", ") || "No holders";
  // Same hug-the-bars lane as StatCard: a fixed 110px lane stretches a
  // handful of bars across the full width (wide gaps). ~12px per bar keeps
  // them tight; full width only when there are enough bars to fill it.
  const chartWidth =
    series.length > 0 ? Math.min(110, Math.max(series.length * 12, 24)) : 110;

  return (
    <Card className="relative overflow-hidden text-white hover:shadow-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <HandCoins size={18} />
            </span>
            <span className="font-display truncate text-sm font-medium tracking-tight text-white/70">
              Open Abono
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span className="font-display tabular-nums text-2xl sm:text-3xl font-medium tracking-tight truncate text-white">
              {formatMoney(openTotal)}
            </span>
            <span className="text-sm font-medium text-white/70">
              {openCount === 1 ? "1 open" : `${openCount} open`}
            </span>
          </div>
        </div>

        {series.length > 0 && (
          <div
            className="shrink-0 self-end opacity-90"
            style={{ width: chartWidth }}
          >
            <AbonoMiniBars data={series} />
          </div>
        )}
      </div>

      <div
        className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3"
        title={stackTitle}
      >
        {stack.length > 0 ? (
          <div className="flex items-center">
            {stack.map((e, i) => (
              <span
                key={e.userId ?? i}
                title={`${e.name} — ${formatMoney(e.openTotal)}`}
                className={i > 0 ? "-ml-2" : ""}
              >
                <EmployeeAvatar
                  name={e.name}
                  avatarUrl={e.avatarUrl}
                  className="h-7 w-7 text-xs ring-2 ring-[var(--accent)]"
                />
              </span>
            ))}
            {overflow > 0 && (
              <span
                title={stackTitle}
                className="-ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-medium text-white ring-2 ring-[var(--accent)]"
              >
                +{overflow}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/60">No open abono holders</p>
        )}
        <p className="min-w-0 truncate text-[11px] text-white/60">
          {stack.length > 0
            ? `${employees.length} ${employees.length === 1 ? "employee holds" : "employees hold"} open abono`
            : "Settled abono leaves the pool"}
        </p>
      </div>
    </Card>
  );
}

function AbonoMiniBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={42}>
      <BarChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Bar
          dataKey="v"
          fill="#FFFFFF"
          radius={[3, 3, 0, 0]}
          barSize={6}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default AbonoStatCard;
