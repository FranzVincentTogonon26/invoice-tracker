import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact page-number window for the pager ("1 … 4 5 6 … 12"). Kept local —
// every table that paginates client-side renders identically through `Pager`.
const pageItems = (count, current) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const items = [0];
  if (current > 2) items.push("…");
  for (
    let i = Math.max(1, current - 1);
    i <= Math.min(count - 2, current + 1);
    i++
  ) {
    items.push(i);
  }
  if (current < count - 3) items.push("…");
  items.push(count - 1);
  return items;
};

const PagerButton = ({
  label,
  children,
  active = false,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    aria-label={label}
    aria-current={active ? "page" : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums tracking-tight transition-colors",
      active
        ? "border-transparent bg-[var(--accent-strong)] text-white shadow-card"
        : "border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
      disabled && "pointer-events-none opacity-40",
    )}
  >
    {children}
  </button>
);

/**
 * Accessible pagination nav for client-side tables.
 * `page` is zero-based. Renders Previous/Next arrows with a compact window of
 * page numbers ("1 … 4 5 6 … 12") — the same pattern every budget table uses.
 * Returns `null` when there's nothing to page through (`pageCount <= 1`).
 */
export function Pager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5">
      <PagerButton
        label="Previous page"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={14} />
      </PagerButton>
      {pageItems(pageCount, page).map((item, i) =>
        item === "…" ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1 text-sm text-[var(--ink-muted)]"
          >
            …
          </span>
        ) : (
          <PagerButton
            key={item}
            label={`Page ${item + 1}`}
            active={item === page}
            onClick={() => onChange(item)}
          >
            {item + 1}
          </PagerButton>
        ),
      )}
      <PagerButton
        label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={14} />
      </PagerButton>
    </nav>
  );
}
