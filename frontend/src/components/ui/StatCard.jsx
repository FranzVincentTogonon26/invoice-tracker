import { useEffect, useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, YAxis, ReferenceLine } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { cn } from "../../lib/utils";

/* ── Animated headline number ─────────────────────────────────────────────
   The dashboard's AnimatedMoney approach, generalized: a framer spring
   drives the numeric core of the rendered value (count-up on mount, quick
   roll on every update) while the surrounding text is rebuilt from the
   original string — prefix (₱), suffix (%), thousands separators and the
   exact decimal count — so the settled frame reads back precisely what a
   static render would have shown. Wordy or empty values ("—", names) fall
   back to plain text. */
const STAT_SPRING = { stiffness: 190, damping: 26, mass: 0.5 };

function deconstructStatValue(raw) {
  const text = String(raw ?? "").trim();
  if (!text || text === "—" || /[A-Za-z]/.test(text)) return null;
  const match = text.match(/^([+-]?)([^\d]*)([\d,]+(?:\.\d+)?)([^\d]*)$/);
  if (!match) return null;
  const [, sign, prefix, num, suffix] = match;
  const decimals = (num.split(".")[1] ?? "").length;
  const target = Number(sign + num.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;
  return {
    sign,
    prefix,
    suffix,
    decimals,
    grouped: num.includes(","),
    target,
  };
}

function AnimatedStatValue({ value, className }) {
  const parsed = useMemo(() => deconstructStatValue(value), [value]);

  const formatter = useMemo(
    () =>
      parsed
        ? new Intl.NumberFormat("en-US", {
            useGrouping: parsed.grouped,
            minimumFractionDigits: parsed.decimals,
            maximumFractionDigits: parsed.decimals,
          })
        : null,
    [parsed],
  );

  const spring = useSpring(0, STAT_SPRING);
  const text = useTransform(spring, (v) => {
    if (!formatter) return "";
    return `${parsed.sign}${parsed.prefix}${formatter.format(Math.abs(v))}${parsed.suffix}`;
  });

  useEffect(() => {
    if (parsed) spring.set(parsed.target);
  }, [parsed, spring]);

  if (!formatter) return <span className={className}>{value}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

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

// Gradient ids must not collide across the many sparklines on a page — key
// them off the color; the same color always yields the same (identical)
// definition, so aliasing is harmless while different colors get their own.
const washId = (color) => `stat-wash-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

function MiniLine({ data, color }) {
  const gid = washId(color);
  // The domain has to admit zero on *both* sides: the default [0, auto]
  // clamps negative buckets to the floor, so a net-position series with
  // spending days flattens into a fake baseline. A touch of padding keeps
  // peaks off the frame.
  const values = (data ?? []).map((point) => Number(point?.v) || 0);
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (!values.length || lo === hi) {
    lo = -1;
    hi = 1;
  }
  const pad = (hi - lo) * 0.08;
  const lastIndex = values.length - 1;
  // Terminal dot — where the series ended, so a one-bucket line still
  // reads as a point instead of an empty lane.
  const endDot = ({ cx, cy, index }) => {
    if (index !== lastIndex || cx == null || cy == null) return null;
    return (
      <circle
        key={`end-${index}`}
        cx={cx}
        cy={cy}
        r={2.5}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={1}
      />
    );
  };
  return (
    <ResponsiveContainer width="100%" height={42}>
      <AreaChart data={data} margin={{ top: 6, right: 2, bottom: 2, left: 2 }}>
        {/* Soft wash under the curve — the same depth treatment the main
            dashboard graph uses, scaled down to the stat-card lane. `style`
            is used because CSS variables don't resolve in SVG attributes. */}
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[lo - pad, hi + pad]} />
        {/* Zero baseline — the line's true reference: money above, spending
            below. Keeps mixed-sign days honest at a glance. */}
        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="2 3" />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          fill={`url(#${gid})`}
          fillOpacity={1}
          baseValue={0}
          dot={endDot}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// No entry animation: the sparkline is a read-out, not an entrance — the bars
// must be painted on the first frame the card is visible (the card itself
// already animates in via framer-motion).
function MiniBars({ data, color }) {
  const gid = `stat-bar-wash-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={42}>
      {/* Bars size themselves off the lane: three days read as chunky
          rounded columns, thirty as a thin picket fence — the 18% category
          gap keeps them from ever melting into one blob. */}
      <BarChart
        data={data}
        margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
        barCategoryGap="18%"
      >
        {/* Color-dense at the bar tops melting down — same depth treatment
            as the line wash, so line and bar sparklines stay siblings.
            `style` is used because CSS variables don't resolve everywhere. */}
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
            <stop
              offset="100%"
              style={{ stopColor: color, stopOpacity: 0.45 }}
            />
          </linearGradient>
        </defs>
        <Bar
          dataKey="v"
          fill={`url(#${gid})`}
          radius={[3, 3, 0, 0]}
          maxBarSize={9}
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
  // Singular noun for the breakdown count pill (e.g. "source" renders
  // "2 sources"). Omitted → the pill keeps showing the bare number.
  breakdownCountNoun,
  // Set false to hide the breakdown count pill entirely.
  showBreakdownCount = true,
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
  // ≤84px lane: with band-adaptive bars a wider lane buys no extra
  // legibility, and it keeps the headline comfortable at four columns.
  const chartWidth = hasData
    ? Math.min(84, Math.max(data.length * 12, 24))
    : 84;

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
        className={cn(
          "group relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:content-[''] before:opacity-70",
          accent &&
            "text-white before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]",
        )}
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
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                  iconTile,
                  "shadow-[inset_0_0_0_1px_color-mix(in_srgb,currentColor_25%,transparent)]",
                )}
              >
                <Icon size={18} />
              </span>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={cn(
                  "font-display min-w-0 truncate text-sm font-medium tracking-tight",
                  accent ? "text-white/70" : "text-[var(--ink-muted)]",
                )}
              >
                {label}
              </p>
              <p
                className={cn(
                  "font-display shrink-0 tabular-nums text-xl sm:text-2xl font-medium tracking-tight",
                  valueColor,
                )}
              >
                <AnimatedStatValue value={displayValue} />
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
                          "min-w-0 truncate text-sm font-medium tabular-nums",
                          breakdownValueTone(stat.tone, accent),
                        )}
                        title={
                          typeof stat.value === "string"
                            ? stat.value
                            : undefined
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
                        "mt-1 truncate text-sm font-medium tabular-nums",
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
        "group relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:content-[''] before:opacity-70",
        accent && "text-white hover:shadow-hover",
        !accent && "hover:-translate-y-0.5",
        !accent && tone === "warning" && "border-[var(--warning)]/45",
        !accent && tone === "danger" && "border-[var(--danger)]/45",
        // Per-tone tinted hairline along the top edge + matching inner
        // ring on hover — the card leans into its own color identity.
        !accent &&
          tone === "success" &&
          "before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--success)_45%,transparent),transparent)] hover:ring-1 hover:ring-inset hover:ring-[var(--success)]/30",
        !accent &&
          tone === "warning" &&
          "before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--warning)_45%,transparent),transparent)] hover:ring-1 hover:ring-inset hover:ring-[var(--warning)]/30",
        !accent &&
          tone === "danger" &&
          "before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--danger)_45%,transparent),transparent)] hover:ring-1 hover:ring-inset hover:ring-[var(--danger)]/30",
        !accent &&
          !tone &&
          "before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_40%,transparent),transparent)] hover:ring-1 hover:ring-inset hover:ring-[var(--accent)]/25",
        !accent &&
          tone &&
          tone !== "success" &&
          tone !== "warning" &&
          tone !== "danger" &&
          "before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--accent)_40%,transparent),transparent)] hover:ring-1 hover:ring-inset hover:ring-[var(--accent)]/25",
        accent &&
          "before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]",
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
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                  iconTile,
                  "shadow-[inset_0_0_0_1px_color-mix(in_srgb,currentColor_25%,transparent)]",
                )}
              >
                <Icon size={18} />
              </span>
            )}
            <span
              className={cn(
                "font-display truncate text-sm font-medium tracking-tight",
                accent ? "text-white/70" : "text-[var(--ink-muted)]",
              )}
            >
              {label}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                "min-w-0 truncate font-display tabular-nums text-2xl sm:text-3xl font-medium tracking-tight",
                valueColor,
              )}
            >
              <AnimatedStatValue value={displayValue} />
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

          {(hasCaption || delta != null) && (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              {hasCaption && (
                <p
                  className={cn(
                    "type-eyebrow text-pretty text-[12px] leading-snug",
                    accent ? "text-white/60" : "text-[var(--ink-muted)]",
                  )}
                >
                  {breakdownCaption}
                </p>
              )}
              {delta != null && (
                <div
                  className={cn(
                    "flex min-w-0 shrink-0 items-center gap-1.5",
                    !hasCaption && "ml-auto",
                  )}
                >
                  <motion.span
                    key={delta}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex"
                  >
                    <Badge
                      tone={deltaTone}
                      className={cn(
                        "shrink-0 gap-1 px-1.5 py-0.5 text-[10px]",
                        accent && "bg-white/15 text-white",
                      )}
                    >
                      <DeltaIcon size={10} aria-hidden />
                      {deltaFlat ? "0%" : `${deltaUp ? "+" : ""}${delta}%`}
                      <span className="sr-only">
                        {deltaWord}
                        {deltaCaption ? ` ${deltaCaption}` : ""}
                      </span>
                    </Badge>
                  </motion.span>
                  {deltaCaption && (
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        accent ? "text-white/60" : "text-[var(--ink-muted)]",
                      )}
                    >
                      {deltaCaption}
                    </span>
                  )}
                </div>
              )}
            </div>
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
                {showBreakdownCount && (
                  <span
                    className={cn(
                      "text-xs font-normal tabular-nums rounded-full px-1.5 py-0.5",
                      accent
                        ? "bg-white/10 text-white/70"
                        : "bg-[var(--surface-2)] text-[var(--ink-muted)]",
                    )}
                  >
                    {breakdownCountNoun
                      ? `${breakdown.length} ${breakdown.length === 1 ? breakdownCountNoun : `${breakdownCountNoun}s`}`
                      : breakdown.length}
                  </span>
                )}
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
                          "shrink-0 font-medium tabular-nums",
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
                      "min-w-0 truncate text-sm font-medium tabular-nums",
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
                    "mt-1 truncate text-sm font-medium tabular-nums",
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
    </Card>
  );
}
