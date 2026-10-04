import { ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { cn } from "../../lib/utils";

/** Dot color for a breakdown row. `warning` is supported so amber states
   (draft, closed) can mirror the badges used in the ledger tables. */
const breakdownDotTone = (tone, accent) =>
  tone === "danger"
    ? "bg-[var(--danger)]"
    : tone === "warning"
      ? "bg-[var(--warning)]"
      : tone === "success"
        ? "bg-[var(--success)]"
        : accent
          ? "bg-white/40"
          : "bg-[var(--accent)]/60";

/** Value color for a breakdown row — same tone vocabulary as the dot. */
const breakdownValueTone = (tone, accent) =>
  tone === "danger"
    ? "text-[var(--danger)]"
    : tone === "warning"
      ? "text-[var(--warning)]"
      : tone === "success"
        ? "text-[var(--success)]"
        : accent
          ? "text-white"
          : "text-[var(--ink)]";

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

// No entry animation: the sparkline is a read-out, not an entrance — the bars
// must be painted on the first frame the card is visible (the card itself
// already animates in via framer-motion).
function MiniBars({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={42}>
      <BarChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Bar
          dataKey="v"
          fill={color}
          radius={[3, 3, 0, 0]}
          barSize={6}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaCaption,
  deltaPolarity = "up-good",
  chart = "line",
  data = [],
  breakdown,
  breakdownCaption = "Per reference",
  stats,
  loading = false,
  icon: Icon,
  accent = false,
  tone,
  status,
  inline = false,
}) {
  const deltaUp = delta != null && delta > 0;
  const deltaFlat = delta === 0;
  const deltaGood = deltaPolarity === "up-bad" ? !deltaUp : deltaUp;
  const deltaTone = accent
    ? "ink"
    : deltaFlat
      ? "neutral"
      : deltaGood
        ? "success"
        : "danger";
  const DeltaIcon = deltaFlat ? Minus : deltaUp ? TrendingUp : TrendingDown;
  const deltaWord = deltaFlat ? "no change" : deltaUp ? "increase" : "decrease";
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
  const hasStats = Array.isArray(stats) && stats.length > 0;
  const hasCaption = !hasBreakdown && !hasStats && Boolean(breakdownCaption);
  // Hug the bars: a fixed 110px lane stretches a handful of bars across the
  // full width (wide gaps). ~12px per bar keeps them tight; full width only
  // when there are enough bars to fill it.
  const chartWidth = hasData ? Math.min(110, Math.max(data.length * 12, 24)) : 110;

  const iconTile = accent
    ? "bg-white/15 text-white"
    : tone === "success"
      ? "bg-[var(--success)]/12 text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning)]/14 text-[var(--warning)]"
        : tone === "danger"
          ? "bg-[var(--danger)]/12 text-[var(--danger)]"
          : "bg-[var(--accent-soft)] text-[var(--accent-strong)]";

  const valueColor = accent
    ? "text-white"
    : tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--ink)]";

  if (loading) {
    if (inline) {
      return (
        <Card
          variant={accent ? "accent" : "default"}
          className={cn("relative overflow-hidden", accent && "text-white")}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={cn(
                  "h-9 w-9 shrink-0 rounded-xl animate-pulse",
                  accent ? "bg-white/15" : "bg-[var(--surface-2)]",
                )}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "h-3 w-24 rounded animate-pulse",
                    accent ? "bg-white/15" : "bg-[var(--surface-2)]",
                  )}
                />
                <div
                  className={cn(
                    "mt-2 h-7 w-28 rounded-lg animate-pulse",
                    accent ? "bg-white/15" : "bg-[var(--surface-2)]",
                  )}
                />
              </div>
            </div>
            <div
              className={cn(
                "h-12 flex-1 rounded-lg animate-pulse",
                accent ? "bg-white/10" : "bg-[var(--surface-2)]",
              )}
            />
          </div>
        </Card>
      );
    }
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
        {(hasData || hasBreakdown || hasStats) && (
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

  // ── Inline (single-row strip) variant — for full-width cards ──────────
  // Label/value + chart on the left, stats arranged in a single row by label.
  if (inline) {
    return (
      <Card
        variant={accent ? "accent" : "default"}
        className={cn(
          "relative overflow-hidden",
          accent && "text-white hover:shadow-hover",
          !accent && "hover:-translate-y-0.5",
          !accent && tone === "warning" && "border-[var(--warning)]/45",
          !accent && tone === "danger" && "border-[var(--danger)]/45",
        )}
      >
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          {/* Label + value + chart */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
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
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={cn(
                  "font-display min-w-0 truncate text-sm font-semibold tracking-tight",
                  accent ? "text-white/70" : "text-[var(--ink-muted)]",
                )}
              >
                {label}
              </p>
              <p
                className={cn(
                  "font-display shrink-0 tabular-nums text-xl sm:text-2xl font-semibold tracking-tight",
                  valueColor,
                )}
              >
                {displayValue}
                {suffix && (
                  <span
                    className={cn(
                      "ml-1 text-sm font-medium",
                      accent ? "text-white/70" : "text-[var(--ink-muted)]",
                    )}
                  >
                    {suffix}
                  </span>
                )}
              </p>
            </div>
            {hasData && (
              <div
                className="ml-auto shrink-0 opacity-90"
                style={{ width: chartWidth }}
              >
                <ChartCmp data={data} color={color} />
              </div>
            )}
          </div>

          {/* Stats — single row arranged by label */}
          {hasStats && (
            <div
              aria-label="Card figures"
              className={cn(
                "grid shrink-0 grid-cols-3 gap-2 border-t pt-3 lg:w-auto lg:min-w-[320px] lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6",
                accent ? "border-white/20" : "border-[var(--border)]",
              )}
            >
              {stats.map((stat, i) => (
                <div
                  key={stat.key ?? i}
                  className="min-w-0 px-3 text-center first:pl-0 last:pr-0"
                >
                  <p
                    className={cn(
                      "type-eyebrow truncate text-[12px]",
                      accent ? "text-white/55" : "text-[var(--ink-muted)]",
                    )}
                    title={stat.label}
                  >
                    {stat.label}
                  </p>
                  {stat.hint != null ? (
                    <p className="mt-1 flex min-w-0 items-center justify-center gap-1.5">
                      <span
                        className={cn(
                          "min-w-0 truncate text-sm font-semibold tabular-nums",
                          breakdownValueTone(stat.tone, accent),
                        )}
                        title={
                          typeof stat.value === "string" ? stat.value : undefined
                        }
                      >
                        {stat.value ?? "—"}
                      </span>
                      <Badge
                        tone={stat.hintTone ?? "neutral"}
                        className={cn(
                          "ml-auto shrink-0 px-1.5 py-0.5 text-[11px]",
                          accent && "border-transparent bg-white/15 text-white",
                        )}
                        title={
                          typeof stat.hint === "string" ? stat.hint : undefined
                        }
                      >
                        {stat.hint}
                      </Badge>
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "mt-1 truncate text-sm font-semibold tabular-nums",
                        breakdownValueTone(stat.tone, accent),
                      )}
                      title={
                        typeof stat.value === "string" ? stat.value : undefined
                      }
                    >
                      {stat.value ?? "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
        !accent && tone === "warning" && "border-[var(--warning)]/45",
        !accent && tone === "danger" && "border-[var(--danger)]/45",
      )}
    >
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
                "font-display truncate text-sm font-semibold tracking-tight",
                accent ? "text-white/70" : "text-[var(--ink-muted)]",
              )}
            >
              {label}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                "font-display tabular-nums text-2xl sm:text-3xl font-semibold tracking-tight truncate",
                valueColor,
              )}
            >
              {displayValue}
            </span>
            {status?.label != null &&
              (() => {
                return (
                  <>
                    <span className="">/</span>
                    <Badge
                      role="status"
                      tone={status.tone ?? "neutral"}
                      className={cn(accent && "bg-white/15 text-white")}
                    >
                      {status.label}
                    </Badge>
                  </>
                );
              })()}
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge
                tone={deltaTone}
                className={cn(accent && "bg-white/15 text-white")}
              >
                <DeltaIcon size={13} aria-hidden />
                {deltaFlat ? "0%" : `${deltaUp ? "+" : ""}${delta}%`}
                <span className="sr-only">
                  {deltaWord}
                  {deltaCaption ? ` ${deltaCaption}` : ""}
                </span>
              </Badge>
              {deltaCaption && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  {deltaCaption}
                </span>
              )}
            </div>
          )}

          {hasCaption && (
            <p
              className={cn(
                "text-xs leading-relaxed",
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
                    "type-eyebrow",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  {breakdownCaption}
                </span>
                <span
                  className={cn(
                    "text-xs font-normal tabular-nums rounded-full px-1.5 py-0.5",
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
                    "text-sm  py-1",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  No records yet
                </p>
              ) : (
                <ul
                  tabIndex={0}
                  aria-label={`${breakdownCaption ?? "Breakdown"} — scrollable list`}
                  className="max-h-36 space-y-1 overflow-y-auto scrollbar-inline pr-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                >
                  {breakdown.map((item, i) => (
                    <li
                      key={item.key ?? i}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            breakdownDotTone(item.tone, accent),
                          )}
                        />
                        {/* Single-line row: label with the date inline after
                           it (same pattern as SelectReference rows) */}
                        <span
                          className={cn(
                            "min-w-0 truncate text-xs",
                            accent
                              ? "text-white/90"
                              : "text-[var(--ink-muted)]",
                          )}
                        >
                          {item.label ?? "—"}
                          {item.hint != null && (
                            <span className="text-[12px] opacity-60">
                              {" · "}
                              {item.hint}
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          breakdownValueTone(item.tone, accent),
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
          <div
            className="shrink-0 self-end opacity-90"
            style={{ width: chartWidth }}
          >
            <ChartCmp data={data} color={color} />
          </div>
        )}
      </div>

      {hasStats && (
        <div
          aria-label="Card figures"
          className={cn(
            "mt-4 grid border-t pt-3",
            accent ? "border-white/20" : "border-[var(--border)]",
          )}
          style={{
            gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={stat.key ?? i}
              className={cn(
                "min-w-0 px-3 first:pl-0 last:pr-0",
                i > 0 &&
                  (accent
                    ? "border-l border-white/15"
                    : "border-l border-[var(--border)]"),
              )}
            >
              <p
                className={cn(
                  "type-eyebrow truncate text-[12px]",
                  accent ? "text-white/55" : "text-[var(--ink-muted)]",
                )}
                title={stat.label}
              >
                {stat.label}
              </p>
              {stat.hint != null ? (
                <p className="mt-1 flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm font-semibold tabular-nums",
                      breakdownValueTone(stat.tone, accent),
                    )}
                    title={
                      typeof stat.value === "string" ? stat.value : undefined
                    }
                  >
                    {stat.value ?? "—"}
                  </span>
                  <Badge
                    tone={stat.hintTone ?? "neutral"}
                    className={cn(
                      "ml-auto shrink-0 px-1.5 py-0.5 text-[11px]",
                      accent && "border-transparent bg-white/15 text-white",
                    )}
                    title={typeof stat.hint === "string" ? stat.hint : undefined}
                  >
                    {stat.hint}
                  </Badge>
                </p>
              ) : (
                <p
                  className={cn(
                    "mt-1 truncate text-sm font-semibold tabular-nums",
                    breakdownValueTone(stat.tone, accent),
                  )}
                  title={typeof stat.value === "string" ? stat.value : undefined}
                >
                  {stat.value ?? "—"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
