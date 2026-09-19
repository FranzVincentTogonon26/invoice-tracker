import { cn } from "@/lib/utils";

/**
 * Page title block. Stacks on phones (title above a full-width action row) and
 * becomes a single baseline-aligned row from `sm` up, so every page shares the
 * same header rhythm instead of each one passing its own flex overrides.
 */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="w-full shrink-0 sm:w-auto">{actions}</div>
      )}
    </div>
  );
}
