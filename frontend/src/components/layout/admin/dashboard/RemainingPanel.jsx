import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../ui/Card";
import { cn, formatMoney } from "../../../../lib/utils";
import { CHART_EASE } from "../../../../lib/dashboard";
import AnimatedMoney from "./AnimatedMoney";

/* ── Left panel: remaining hero + per-source utilization rows ─────────── */

export default function RemainingPanel({ total, flow, sources, selected }) {
  const nav = useNavigate();
  const flowTotal = flow.issued + flow.spent + flow.remaining;
  const segments = [
    {
      key: "issued",
      label: "Issued",
      value: flow.issued,
      color: "white",
    },
    {
      key: "spent",
      label: "Spent",
      value: flow.spent,
      color: "var(--warning)",
    },
    {
      key: "remaining",
      label: "Balance",
      value: flow.remaining,
      color: "rgba(255, 255, 255, 0.45)",
    },
  ];

  return (
    <Card
      padding="lg"
      radius="lg"
      className="flex h-full flex-col overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: CHART_EASE }}
        className="rounded-2xl bg-[image:linear-gradient(135deg,var(--accent-hero-2)_0%,var(--accent-hero)_60%,var(--accent-hero)_100%)] px-5 py-6 text-white shadow-card"
      >
        <p className="type-eyebrow text-white/60">Current Remaining Balance</p>
        <AnimatedMoney
          value={total}
          className="mt-2 block break-words font-display text-3xl font-medium tracking-tight tabular-nums xl:text-4xl"
        />
        <p className="mt-2 text-xs text-white/70">
          Across {sources.length} open{" "}
          {sources.length === 1 ? "source" : "sources"} of funds
        </p>

        {/* Pool composition — where the money went or still sits */}
        {flowTotal > 0 && (
          <>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/15">
              {segments.map((seg, i) => (
                <motion.span
                  key={seg.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${(seg.value / flowTotal) * 100}%` }}
                  transition={{
                    duration: 0.9,
                    ease: CHART_EASE,
                    delay: 0.25 + i * 0.12,
                  }}
                  className="h-full"
                  style={{ backgroundColor: seg.color }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/70">
              {segments.map((seg) => (
                <span
                  key={seg.key}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  {seg.label}
                </span>
              ))}
            </div>
          </>
        )}
      </motion.div>

      <div className="mt-4 flex items-center justify-between px-1">
        <span className="type-eyebrow text-[var(--ink-muted)]">
          Open Sources
        </span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--ink-muted)]">
          {sources.length}
        </span>
      </div>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
        }}
        aria-label="Open budget sources and their remaining balance"
        className="scrollbar-inline mt-2 max-h-96 flex-1 space-y-1 overflow-y-auto pr-1 lg:max-h-[420px]"
      >
        {sources.map((source) => {
          const isSelected = selected === source.reference_id;
          const allocated = Number(source.allocated) || 0;
          const used =
            (Number(source.issued) || 0) + (Number(source.expenses) || 0);
          const hasBudget = allocated > 0;
          const pct = hasBudget ? Math.min(100, (used / allocated) * 100) : 0;
          // Utilization label: one decimal whenever the share isn't a clean
          // integer — and FLOORED, so `Math.round(99.96)` can never print
          // "100%" while the source still has a remaining balance. "100%"
          // only prints when the source is truly exhausted (pct >= 100).
          const pctLabel =
            pct >= 100
              ? "100%"
              : Number.isInteger(pct)
                ? `${pct}%`
                : `${(Math.floor(pct * 10) / 10).toFixed(1)}%`;
          const barColor =
            pct >= 90
              ? "var(--danger)"
              : pct >= 60
                ? "var(--warning)"
                : "var(--accent)";
          return (
            <motion.li
              key={source.reference_id}
              variants={{
                hidden: { opacity: 0, x: -10 },
                show: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.3, ease: CHART_EASE },
                },
              }}
            >
              <button
                type="button"
                onClick={() =>
                  nav(
                    `/admin/source-funds/overview?ref=${source.reference_id}`,
                    {
                      state: { referenceId: source.reference_id },
                    },
                  )
                }
                /* The row deep-links to the source's overview page (same
                   navigation AdminSourceFunds' View details uses). The accent
                   treatment stays as a scope indicator: the source the
                   dashboard is currently filtered to. */
                aria-current={isSelected ? "true" : undefined}
                title={`View ${source.label || "this source"}'s overview`}
                className={cn(
                  "group w-full rounded-xl border px-3.5 py-2 text-left transition-all duration-300",
                  isSelected
                    ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] shadow-card"
                    : "border-[var(--border)] bg-[var(--surface-2)]/40 hover:-translate-y-px hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)] hover:shadow-card",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                    {source.label || "Untitled source"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-display text-sm font-semibold tabular-nums",
                      Number(source.remaining) < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--accent-strong)]",
                    )}
                  >
                    {formatMoney(source.remaining)}
                  </span>
                  {/* Navigation affordance — nudges right on hover. */}
                  <ChevronRight
                    size={14}
                    strokeWidth={2.5}
                    aria-hidden
                    className="shrink-0 text-[var(--ink-muted)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
                  />
                </span>

                {/* Info + utilization bar share one tight row */}
                <span className="mt-1 flex items-center gap-2 text-[10px] text-[var(--ink-muted)]">
                  <span className="min-w-0 flex-1 truncate">
                    {hasBudget
                      ? `${formatMoney(used)} used of ${formatMoney(allocated)}`
                      : "No allocation yet"}
                  </span>
                  {hasBudget && (
                    <>
                      <span className="block h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--ink)]/5">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.8,
                            ease: CHART_EASE,
                            delay: 0.15,
                          }}
                          className="block h-full rounded-full"
                          style={{ backgroundColor: barColor }}
                        />
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {pctLabel}
                      </span>
                    </>
                  )}
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </Card>
  );
}
