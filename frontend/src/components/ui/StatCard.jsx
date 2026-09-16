import { ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { cn } from "../../lib/utils";

function MiniLine({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={42}>
      <LineChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={42}>
      <BarChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} barSize={6} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  delta,
  chart = "line",
  data = [],
  // `breakdown` is opt-in: pass an array of { label, value, hint?, tone? } to
  // render the list section. Passing [] renders an empty state, omitting it
  // renders no list at all.
  breakdown,
  breakdownCaption = "Per reference",
  loading = false,
  icon: Icon,
  accent = false,
  // Optional status tint for the icon tile, value and sparkline — mirrors the
  // app's status colors (active → success, pending → warning, over → danger).
  tone,
}) {
  const positive = delta == null ? null : delta >= 0;
  const color = accent
    ? "#FFFFFF"
    : tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "danger"
          ? "var(--danger)"
          : "var(--accent)";
  const ChartCmp = chart === "bars" ? MiniBars : MiniLine;
  const displayValue = value == null || value === "" ? "—" : value;
  const hasData = Array.isArray(data) && data.length > 0;
  const hasBreakdown = Array.isArray(breakdown);
  // Without a `breakdown` list, `breakdownCaption` (e.g. "Across all
  // employees") is shown as a one-line footer hint instead of being ignored.
  const hasCaption = !hasBreakdown && Boolean(breakdownCaption);

  // Icon tile treatment — soft tinted squircle; `tone` overrides the default
  // accent tint so status cards read at a glance.
  const iconTile = accent
    ? "bg-white/15 text-white"
    : tone === "success"
      ? "bg-[var(--success)]/12 text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning)]/14 text-[var(--warning)]"
        : tone === "danger"
          ? "bg-[var(--danger)]/12 text-[var(--danger)]"
          : "bg-[var(--accent-soft)] text-[var(--accent-strong)]";

  // Value color — status tints carry meaning (green = active, amber = pending).
  const valueColor = accent
    ? "text-white"
    : tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--ink)]";

  // Skeleton placeholders keep the 4-column grid from jumping while the
  // overview query loads.
  if (loading) {
    return (
      <Card
        variant={accent ? "accent" : "default"}
        className={cn("relative overflow-hidden", accent && "text-white")}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "h-9 w-9 rounded-xl animate-pulse",
              accent ? "bg-white/15" : "bg-[var(--surface-2)]",
            )}
          />
          <div
            className={cn(
              "h-3 w-24 rounded animate-pulse",
              accent ? "bg-white/15" : "bg-[var(--surface-2)]",
            )}
          />
        </div>
        <div
          className={cn(
            "mt-3.5 h-8 w-28 rounded-lg animate-pulse",
            accent ? "bg-white/15" : "bg-[var(--surface-2)]",
          )}
        />
        {hasCaption && (
          <div
            className={cn(
              "mt-2 h-2.5 w-24 rounded animate-pulse",
              accent ? "bg-white/10" : "bg-[var(--surface-2)]",
            )}
          />
        )}
        {/* Only reserve the chart/breakdown slot when the caller actually
            supplies that content — otherwise the skeleton renders taller
            than the loaded card and the grid row jumps. */}
        {(hasData || hasBreakdown) && (
          <div
            className={cn(
              "mt-3 h-14 rounded-lg animate-pulse",
              accent ? "bg-white/10" : "bg-[var(--surface-2)]",
            )}
          />
        )}
      </Card>
    );
  }

  return (
    <Card
      variant={accent ? "accent" : "default"}
      className={cn(
        "relative overflow-hidden",
        accent && "text-white hover:shadow-hover",
        !accent && "hover:-translate-y-0.5",
      )}
    >
      {/* Soft light bloom + hairline ring in the top-right corner of the hero
          card — echoes the accent gradient using the existing tokens. */}
      {accent && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_right,var(--accent-hero-2)_0%,transparent_70%)] opacity-50"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full border border-white/10"
          />
        </>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  iconTile,
                )}
              >
                <Icon size={18} />
              </span>
            )}
            <span
              className={cn(
                "truncate text-xs font-semibold tracking-tight",
                accent ? "text-white/70" : "text-[var(--ink-muted)]",
              )}
            >
              {label}
            </span>
          </div>
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className={cn(
                "font-display tabular text-2xl sm:text-3xl font-semibold tracking-tight truncate",
                valueColor,
              )}
            >
              {displayValue}
            </span>
            {suffix && (
              <span
                className={cn(
                  "text-sm font-medium",
                  accent ? "text-white/70" : "text-[var(--ink-muted)]",
                )}
              >
                {suffix}
              </span>
            )}
          </div>
          {delta != null && (
            <Badge
              tone={accent ? "ink" : positive ? "success" : "danger"}
              className={cn(accent && "bg-white/15 text-white")}
            >
              {positive ? "+" : ""}
              {delta}%
            </Badge>
          )}

          {hasCaption && (
            <p
              className={cn(
                "text-[11px] font-medium tracking-tight",
                accent ? "text-white/60" : "text-[var(--ink-muted)]",
              )}
            >
              {breakdownCaption}
            </p>
          )}

          {hasBreakdown && (
            <div
              className={cn(
                "mt-3 border-t pt-2.5",
                accent ? "border-white/20" : "border-[var(--border)]",
              )}
            >
              {/* Caption + count header */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  {breakdownCaption}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular rounded-full px-1.5 py-0.5",
                    accent
                      ? "bg-white/10 text-white/70"
                      : "bg-[var(--surface-2)] text-[var(--ink-muted)]",
                  )}
                >
                  {breakdown.length}
                </span>
              </div>

              {breakdown.length === 0 ? (
                <p
                  className={cn(
                    "text-[11px] italic py-1",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  No records yet
                </p>
              ) : (
                /* Height-capped scroll area — the card never blows past the
                   grid row no matter how many references exist. The app-wide
                   `scrollbar-slim` utility hides the scrollbar visually. */
                <ul className="max-h-36 space-y-1 overflow-y-auto scrollbar-slim pr-1 -mr-1">
                  {breakdown.map((item, i) => (
                    <li
                      key={item.key ?? i}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      {/* Dot + label grouped in one flex unit so the marker
                         stays glued to the text — `justify-between` on the
                         row would otherwise push the dot, label and value
                         apart. Rounded-dot pattern echoes SelectReference
                         metadata dots; tone-tinted to match the value. */}
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            item.tone === "danger"
                              ? "bg-[var(--danger)]"
                              : item.tone === "success"
                                ? "bg-[var(--success)]"
                                : accent
                                  ? "bg-white/40"
                                  : "bg-[var(--accent)]/60",
                          )}
                        />
                        {/* Single-line row: label with the date inline after
                           it (same pattern as SelectReference rows) */}
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            accent ? "text-white/90" : "text-[var(--ink-muted)]",
                          )}
                        >
                          {item.label ?? "—"}
                          {item.hint != null && (
                            <span className="text-[10px] opacity-60">
                              {" · "}
                              {item.hint}
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular",
                          item.tone === "danger"
                            ? "text-[var(--danger)]"
                            : item.tone === "success"
                              ? "text-[var(--success)]"
                              : accent
                                ? "text-white"
                                : "text-[var(--ink)]",
                        )}
                      >
                        {item.value ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {hasData && (
          <div className="w-[110px] shrink-0 self-end opacity-90">
            <ChartCmp data={data} color={color} />
          </div>
        )}
      </div>
    </Card>
  );
}
