import { cn } from "../../../../lib/utils";
import { Card } from "../../../ui/Card";
import { StatCard } from "../../../ui/StatCard";
import { SERIES } from "../../../../lib/dashboard";

/* ── Dashboard skeleton ───────────────────────────────────────────────────
   Mirrors the live layout 1:1 so loading reshuffles nothing: the four money
   stat cards, the remaining-balance panel (accent hero + open-source rows)
   beside the full-bleed graph card with its floating chrome, then the pool
   insights card beside the recent-transactions table — same column split,
   same heights, same chrome. */

const Bar = ({ className }) => (
  <div
    className={cn("animate-pulse rounded bg-[var(--surface-2)]", className)}
  />
);

// Ghost bars for the accent hero block, where surface-2 would disappear.
const HeroBar = ({ className }) => (
  <div className={cn("animate-pulse rounded bg-white/40", className)} />
);

// Column template shared by the table head band and the record rows.
const TABLE_COLS = "grid-cols-[13%_29%_12%_21%_11%_14%]";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {SERIES.map((stat) => (
          <StatCard key={stat.key} label="" value={0} icon={stat.Icon} loading />
        ))}
      </div>

      {/* Row 1 — remaining balance panel · live transaction graph */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-3">
          <Card padding="lg" radius="lg" className="flex h-full flex-col">
            {/* Balance hero + pool composition */}
            <div className="rounded-2xl bg-[image:linear-gradient(135deg,var(--accent-hero-2)_0%,var(--accent-hero)_60%,var(--accent-hero)_100%)] p-5">
              <HeroBar className="h-2.5 w-32" />
              <HeroBar className="mt-3 h-7 w-5/6 rounded-lg" />
              <HeroBar className="mt-2.5 h-2.5 w-1/2" />
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
                <HeroBar className="h-full w-2/3 rounded-full" />
              </div>
              <div className="mt-2 flex items-center gap-x-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <HeroBar
                    key={index}
                    className={cn("h-2.5", ["w-10", "w-12", "w-14"][index])}
                  />
                ))}
              </div>
            </div>

            {/* Open-source rows */}
            <div className="mt-4 flex items-center justify-between px-1">
              <Bar className="h-2.5 w-24" />
              <Bar className="h-5 w-8 rounded-full" />
            </div>
            <ul className="flex-1 space-y-1 pt-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-[var(--border)] px-3.5 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Bar className="h-3 w-24" />
                    <Bar className="h-3 w-16 shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Bar className="h-2 min-w-0 flex-1" />
                    <Bar className="h-1.5 w-14 shrink-0 rounded-full" />
                    <Bar className="h-2 w-6 shrink-0" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Full-bleed chart floor + floating header / legend chips */}
        <div className="min-w-0 lg:col-span-9">
          <Card
            padding="none"
            radius="lg"
            className="relative h-full min-h-[420px] overflow-hidden"
          >
            <div className="absolute inset-0 p-2">
              <Bar className="h-full w-full rounded-2xl opacity-70" />
            </div>
            <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2.5">
                  <Bar className="h-3.5 w-40" />
                  <Bar className="h-4 w-12 rounded-full" />
                </div>
                <Bar className="mt-1.5 h-2.5 w-56" />
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Bar key={index} className="h-4 w-12 rounded-full" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 2 — pool insights panel · recent transactions table */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-3">
          <Card padding="lg" radius="lg" className="flex h-full flex-col">
            {/* Open budget holders */}
            <div className="flex items-center justify-between px-1 pb-1.5">
              <Bar className="h-2.5 w-28" />
              <Bar className="h-5 w-7 rounded-full" />
            </div>
            <ul className="space-y-0.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-2 py-2"
                >
                  <Bar className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Bar className="h-3 w-24" />
                    <Bar className="mt-1.5 h-2 w-32" />
                  </div>
                  <Bar className="h-3 w-16 shrink-0" />
                </li>
              ))}
            </ul>

            <div className="my-4 border-t border-[var(--border)]" />

            {/* Top spending categories */}
            <div className="flex items-center justify-between px-1 pb-1.5">
              <Bar className="h-2.5 w-36" />
              <Bar className="h-5 w-7 rounded-full" />
            </div>
            <ul className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index}>
                  <div className="flex items-center justify-between gap-2">
                    <Bar className="h-2.5 w-24" />
                    <Bar className="h-2 w-6 shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Bar className="h-1.5 min-w-0 flex-1 rounded-full" />
                    <Bar className="h-2 w-12 shrink-0" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Recent transactions — header band + ghost ledger rows */}
        <div className="min-w-0 lg:col-span-9">
          <Card
            padding="none"
            radius="lg"
            className="relative flex h-full flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
              <div>
                <Bar className="h-4 w-40" />
                <Bar className="mt-1.5 h-2.5 w-48" />
              </div>
              <Bar className="h-5 w-20 shrink-0 rounded-full" />
            </div>

            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className={cn(
                    "grid items-center bg-[var(--surface-2)]/90 px-5 py-3",
                    TABLE_COLS,
                  )}
                >
                  {["w-10", "w-20", "w-10", "w-14", "w-10", "w-12"].map(
                    (width, index) => (
                      <Bar key={index} className={cn("h-2", width)} />
                    ),
                  )}
                </div>
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "grid items-center gap-x-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0",
                      TABLE_COLS,
                    )}
                  >
                    <div>
                      <Bar className="h-3 w-3/4" />
                      <Bar className="mt-1 h-2 w-1/2" />
                    </div>
                    <Bar className="h-3 w-9/12" />
                    <Bar className="h-4 w-14 rounded-md" />
                    <div className="flex items-center gap-2">
                      <Bar className="h-7 w-7 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <Bar className="h-2.5 w-16" />
                      </div>
                    </div>
                    <Bar className="h-5 w-14 rounded-full" />
                    <Bar className="ml-auto h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
