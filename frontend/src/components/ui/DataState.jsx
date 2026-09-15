import { Inbox, RotateCcw } from "lucide-react";

/**
 * Skeleton placeholder shown while a data-driven table is loading. `showAvatar`
 * adds the leading avatar circle used by tables with an employee column.
 */
export function LoadingSkeleton({ rows = 5, showAvatar = false }) {
  return (
    <div className="divide-y divide-[var(--border)]" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-5">
          {showAvatar && (
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-[var(--border)]" />
          </div>
          <div className="hidden h-4 w-20 animate-pulse rounded bg-[var(--border)] sm:block" />
          <div className="hidden h-6 w-16 animate-pulse rounded-full bg-[var(--border)] md:block" />
        </div>
      ))}
    </div>
  );
}

/**
 * Centered error panel shown when a fetch fails. `onRetry` renders the "Try
 * again" action and `onClearFilters` an optional "Clear filters" affordance
 * (useful when the failure happened while filters were active).
 */
export function ErrorState({
  title,
  message,
  onRetry,
  onClearFilters,
  clearLabel = "Clear filters",
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
        <RotateCcw size={20} />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{title}</p>
      {message && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
          {message}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
        >
          <RotateCcw size={12} />
          Try again
        </button>
      )}
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
        >
          <RotateCcw size={12} />
          {clearLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Centered empty panel shown when a table has no rows. Pass `onClear` to turn
 * it into a "clear filters" affordance when the empty result is filter-driven.
 * `icon` accepts a lucide component; it defaults to the inbox glyph.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  onClear,
  clearLabel = "Clear filters",
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <Icon size={20} />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{title}</p>
      {message && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
          {message}
        </p>
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
        >
          <RotateCcw size={12} />
          {clearLabel}
        </button>
      )}
    </div>
  );
}