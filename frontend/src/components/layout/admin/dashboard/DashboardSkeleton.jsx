import { StatCard } from "../../../ui/StatCard";
import { SERIES } from "../../../../lib/dashboard";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {SERIES.map((s) => (
          <StatCard key={s.key} label="" value={0} icon={s.Icon} loading />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
        <div className="lg:col-span-9">
          <div className="h-[420px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
        <div className="lg:col-span-3">
          <div className="h-[560px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
        <div className="lg:col-span-9">
          <div className="h-[560px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  );
}
