import { useSocketStatus } from "@/hooks/useRealtime";

/**
 * Tiny live-connection pill for the topbars — green = realtime ledger sync
 * is up, amber = reconnecting, grey = offline. Title carries the detail so
 * admins/employees can tell at a glance their money moves are syncing.
 */
export function SocketStatus() {
  const status = useSocketStatus();
  const dot =
    status === "connected"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-400 animate-pulse"
        : "bg-zinc-400";
  const label =
    status === "connected"
      ? "Live"
      : status === "connecting"
        ? "Connecting…"
        : "Offline";

  return (
    <span
      title={
        status === "connected"
          ? "Realtime connected — transactions sync instantly"
          : "Realtime disconnected — data refreshes on next action"
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)]"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default SocketStatus;
