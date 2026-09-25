import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleAlert,
  CircleCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

// Entrance/exit curve shared with every other overlay in the app, so the sheet
// rises at the same speed as the sidebar's mobile menu.
const SHEET_EASE = [0.16, 1, 0.3, 1];

// Caption styling shared by the sheet's field labels.
const FIELD_LABEL =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]";

// Insight tile tones — mirrors the View-expense modal's recommendations so the
// advice inside a sheet reads in the same visual language.
const TIP_TONE = {
  warning: {
    wrap: "border-[var(--warning)]/20 bg-[var(--warning)]/8",
    badge: "bg-[var(--warning)] text-white",
    Icon: CircleAlert,
  },
  success: {
    wrap: "border-[var(--success)]/20 bg-[var(--success)]/8",
    badge: "bg-[var(--success)] text-white",
    Icon: CircleCheck,
  },
  neutral: {
    wrap: "border-[var(--border)] bg-[var(--surface-2)]/50",
    badge: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    Icon: Sparkles,
  },
};

/** Caption + control wrapper for one sheet field. */
export const FilterSheetField = ({ label, children }) => (
  <div>
    <span className={FIELD_LABEL}>{label}</span>
    {children}
  </div>
);

/**
 * Mobile-only recap of the applied dropdown filters: one removable chip per
 * active filter, so a narrowed list never looks narrowed "for no reason" while
 * the sheet is closed. Renders nothing from `lg` up (the inline dropdowns are
 * their own recap) or when no chip is passed.
 */
export const FilterChips = ({ chips, onClearAll }) => {
  if (!chips?.length) return null;
  return (
    <div className="-mt-2 mb-4 flex items-center gap-2 lg:hidden">
      <div className="scrollbar-slim flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClear}
            aria-label={`Clear ${chip.label} filter`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            {chip.label}
            <X size={12} aria-hidden />
          </button>
        ))}
      </div>
      {chips.length > 1 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        >
          Clear
        </button>
      )}
    </div>
  );
};

// Advice about the staged draft — what applying it would do, or why nothing
// matches. Purely informational, never a control.
const buildTip = ({ draftIsDefault, matchCount, totalRows, hasActiveFilters }) => {
  if (totalRows === 0)
    return {
      tone: "warning",
      title: "Nothing to filter yet",
      body: "Records show up here as soon as there are any to narrow down.",
    };
  if (!draftIsDefault && matchCount === 0)
    return {
      tone: "warning",
      title: "No records match these filters",
      body: "Loosen one of the choices — or reset — to bring records back into the list.",
    };
  if (!draftIsDefault)
    return {
      tone: "success",
      title: `${matchCount} of ${totalRows} ${totalRows === 1 ? "record" : "records"} match`,
      body: "These choices land in the list as soon as you tap the button below.",
    };
  if (hasActiveFilters)
    return {
      tone: "neutral",
      title: "No dropdown filter is set",
      body: "The list is narrowed only by the search box above.",
    };
  return {
    tone: "neutral",
    title: "Everything is showing",
    body: "Pick a value — the count updates as you choose.",
  };
};

const SheetTip = ({ tip }) => {
  const tone = TIP_TONE[tip.tone] ?? TIP_TONE.neutral;
  const Icon = tone.Icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-3.5 py-3",
        tone.wrap,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          tone.badge,
        )}
      >
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[var(--ink)]">
          {tip.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
          {tip.body}
        </p>
      </div>
    </div>
  );
};

/**
 * Bottom-sheet filter surface for mobile (`lg:hidden`) — the small-screen
 * counterpart of a page's inline filter row.
 *
 * The caller stages a draft of its dropdown values and reports how many rows
 * that draft would match (`matchCount`), which is what makes the footer
 * buttons real: "Reset" rewinds the draft through `onReset`, the accent button
 * commits it through `onPrimary`. Dismissing the sheet (Escape, backdrop or
 * the ✕) simply drops the staged choices.
 */
export const FilterSheet = ({
  open,
  onClose,
  title = "Filters",
  description = "Narrow the list with the options below.",
  children,
  draftIsDefault = true,
  matchCount = 0,
  totalRows = 0,
  hasActiveFilters = false,
  onReset,
  onPrimary,
  bodyAction,
}) => {
  const titleId = useId();
  const panelRef = useRef(null);

  // Move focus into the sheet so Tab walks its fields instead of continuing
  // somewhere behind the backdrop (matches the sidebar's mobile menu).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Escape dismisses it. Capture phase + stopPropagation keeps page-level
  // Escape handlers from also firing (matches the dialog pattern).
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const total = Number.isFinite(totalRows) ? totalRows : 0;
  const count = Number.isFinite(matchCount) ? matchCount : 0;
  const tip = buildTip({
    draftIsDefault,
    matchCount: count,
    totalRows: total,
    hasActiveFilters,
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="filter-sheet"
          className="fixed inset-0 z-[70] flex flex-col justify-end lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop tap dismisses (staged choices are simply dropped). */}
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.34, ease: SHEET_EASE }}
            className="relative flex max-h-[88dvh] w-full flex-col rounded-t-[15px] border border-b-0 border-[var(--border)] bg-[var(--surface)] shadow-hover outline-none"
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[var(--ink-muted)]/25" />

            {/* ── Header ── */}
            <div className="flex shrink-0 items-start gap-3 px-4 pt-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <SlidersHorizontal size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                >
                  {title}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1 pt-4">
              <div className="space-y-4">{children}</div>

              <div className="mt-4">
                <SheetTip tip={tip} />
              </div>

              {bodyAction}
            </div>

            {/* ── Footer — the sheet's two working buttons ── */}
            <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                disabled={draftIsDefault}
                className="shrink-0"
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={onPrimary}
                className="min-w-0 flex-1"
              >
                Show {count} {count === 1 ? "result" : "results"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
