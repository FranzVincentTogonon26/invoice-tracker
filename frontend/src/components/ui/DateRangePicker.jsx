import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CalendarOff,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "./Button";
import {
  addDays,
  addMonths,
  cn,
  formatDate,
  formatDateRange,
  getMonthGrid,
  isSameDay,
  monthRange,
  rangeWithPreview,
  selectRangeDay,
  startOfDay,
  startOfMonth,
} from "@/lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const PRESETS = [
  {
    key: "this-month",
    label: "This Month",
    rangeFor: (today) => monthRange(today),
  },
  {
    key: "last-month",
    label: "Last Month",
    rangeFor: (today) => monthRange(addMonths(today, -1)),
  },
  {
    key: "last-7-days",
    label: "Last 7 Days",
    rangeFor: (today) => ({ start: addDays(today, -6), end: today }),
  },
  {
    key: "last-30-days",
    label: "Last 30 Days",
    rangeFor: (today) => ({ start: addDays(today, -29), end: today }),
  },
  {
    key: "this-year",
    label: "This Year",
    rangeFor: (today) => ({
      start: new Date(today.getFullYear(), 0, 1),
      end: new Date(today.getFullYear(), 11, 31),
    }),
  },
];

function normalizeRange(range) {
  return {
    start: range?.start ? startOfDay(range.start) : null,
    end: range?.end ? startOfDay(range.end) : null,
  };
}

function isSameRange(a, b) {
  const left = normalizeRange(a);
  const right = normalizeRange(b);
  return isSameDay(left.start, right.start) && isSameDay(left.end, right.end);
}

function NavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
    >
      {children}
    </button>
  );
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  align = "start",
  className,
  disabled = false,
  // Collapse the trigger to an icon-only button below the `sm` breakpoint
  // (mobile filter rows): the `calendar-days` glyph alone, tinted while a
  // range is applied. The full label returns on `sm:` and up.
  compactOnMobile = false,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeRange(value));
  const [hover, setHover] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value?.start));
  const [slide, setSlide] = useState(1);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  // Portal panel node (lives outside `rootRef`, so the outside-click check
  // needs both) and its viewport-anchored position while open.
  const panelRef = useRef(null);
  const [panelPos, setPanelPos] = useState(null);

  const today = useMemo(() => startOfDay(), []);
  const cells = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);
  const label = formatDateRange(value, placeholder);
  const hasValue = Boolean(value?.start && value?.end);
  const painted = useMemo(() => rangeWithPreview(draft, hover), [draft, hover]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setHover(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Viewport-anchored position for the portal panel (desktop). The panel
  // renders in `document.body`, so it escapes the Card's `overflow-hidden`
  // and always floats above the content.
  const computePanelPos = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    // Mobile keeps the centered sheet — no anchor math needed.
    if (window.innerWidth < 640) {
      setPanelPos({ mobile: true });
      return;
    }
    const PANEL_WIDTH = 560;
    const rect = el.getBoundingClientRect();
    const left = align === "end" ? rect.right - PANEL_WIDTH : rect.left;
    setPanelPos({
      top: Math.max(8, rect.bottom + 8),
      left: Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8)),
      width: PANEL_WIDTH,
    });
  }, [align]);

  const openPanel = () => {
    const range = normalizeRange(value);
    setDraft(range);
    setViewMonth(startOfMonth(range.start));
    setSlide(1);
    setHover(null);
    computePanelPos();
    setOpen(true);
  };

  const toggle = () => (open ? close() : openPanel());

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      // The panel lives in a portal — a click inside it is outside `rootRef`,
      // so both nodes must count as "inside", or every panel click closes it.
      if (rootRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      close(false);
    };

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };

    // Keep the anchored panel glued to the trigger while it is open.
    const reposition = () => computePanelPos();

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, close, computePanelPos]);

  const shiftMonth = (amount) => {
    setSlide(amount);
    setViewMonth((current) => addMonths(current, amount));
  };

  const pickDay = (day) => {
    setHover(null);
    setDraft((current) => selectRangeDay(current, day));
  };

  const pickPreset = (preset) => {
    const range = normalizeRange(preset.rangeFor(today));
    setDraft(range);
    setViewMonth(startOfMonth(range.start));
    setSlide(1);
    setHover(null);
  };

  const reset = () => {
    setDraft({ start: null, end: null });
    setHover(null);
  };

  const apply = () => {
    if (!draft.start || !draft.end) return;
    onChange?.({ start: draft.start, end: draft.end });
    close();
  };

  const draftComplete = Boolean(draft.start && draft.end);
  const canClear = hasValue && !draftComplete;

  const clearRange = () => {
    onChange?.({ start: null, end: null });
    close();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-0",
        compactOnMobile ? "shrink-0" : "flex-1 sm:flex-none",
      )}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="soft"
        className={cn(
          "max-w-full px-5",
          // Solid hairline + card shadow in both states, matching SearchInput
          // and the rest of the filter row (no more dashed trigger).
          hasValue
            ? "border border-[var(--accent)]/35 font-semibold shadow-card hover:shadow-hover"
            : "border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--ink-muted)] shadow-card hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)] hover:text-[var(--ink)] hover:shadow-hover",
          // Mobile filter row: a 44px icon-only trigger that matches the
          // search field's height; `sm:` restores the full-width label.
          compactOnMobile && "w-11 px-0 sm:w-auto sm:px-5",
          className,
        )}
        data-state={hasValue ? "set" : "unset"}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          compactOnMobile
            ? hasValue
              ? `Date range: ${label}. Activate to change.`
              : "Filter by date range"
            : hasValue
              ? `Date range: ${label}`
              : `Date range: ${label} — no date range set`
        }
      >
        {/* Mobile-only glyph — the full trigger returns at `sm`. */}
        {compactOnMobile && (
          <CalendarDays
            size={16}
            aria-hidden
            className={cn("shrink-0 sm:hidden", !hasValue && "opacity-70")}
          />
        )}
        {hasValue ? (
          <CalendarRange
            size={15}
            aria-hidden
            className={cn("shrink-0", compactOnMobile && "hidden sm:block")}
          />
        ) : (
          <CalendarOff
            size={15}
            aria-hidden
            className={cn(
              "shrink-0",
              compactOnMobile && "hidden sm:block",
            )}
          />
        )}
        <span
          className={cn(
            "min-w-0 max-w-full truncate tabular-nums",
            compactOnMobile && "hidden sm:inline",
          )}
        >
          {label}
        </span>
      </Button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-label="Select date range"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: DIALOG_EASE }}
                style={
                  panelPos && !panelPos.mobile
                    ? {
                        position: "fixed",
                        top: panelPos.top,
                        left: panelPos.left,
                        width: panelPos.width,
                      }
                    : undefined
                }
                className={cn(
                  // Portal + `fixed z-[70]`: escapes the Card's
                  // `overflow-hidden` and floats above all page content.
                  "fixed z-[70] w-[min(92vw,560px)] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover",
                  // Mobile keeps the roomy centered sheet; desktop gets a
                  // 560px panel anchored under the trigger.
                  "max-sm:inset-x-4 max-sm:top-[10vh] max-sm:max-h-[80dvh] max-sm:overflow-y-auto",
                  "sm:max-h-[calc(100dvh-96px)] sm:overflow-y-auto",
                )}
              >
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
              <span className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
                Date range
              </span>
              <span className="truncate text-sm font-semibold text-[var(--ink-muted)]">
                {formatDateRange(
                  draft,
                  hasValue
                    ? "Pick a start and end date"
                    : "No range set — all records",
                )}
              </span>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[172px_1fr] sm:gap-5 sm:p-5">
              <div
                role="group"
                aria-label="Quick ranges"
                className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap"
              >
                {PRESETS.map((preset) => {
                  const active = isSameRange(draft, preset.rangeFor(today));
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => pickPreset(preset)}
                      aria-pressed={active}
                      className={cn(
                        "h-8 shrink-0 rounded-full px-3 text-sm font-medium transition-colors sm:text-left",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-w-0" onMouseLeave={() => setHover(null)}>
                <div className="mb-2 flex items-center justify-between">
                  <NavButton
                    label="Previous month"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </NavButton>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {viewMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <NavButton label="Next month" onClick={() => shiftMonth(1)}>
                    <ChevronRight size={16} aria-hidden />
                  </NavButton>
                </div>

                <div className="grid grid-cols-7">
                  {WEEKDAYS.map((day) => (
                    <span
                      key={day}
                      aria-hidden
                      className="flex h-7 items-center justify-center type-eyebrow text-[var(--ink-muted)]"
                    >
                      {day}
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={`${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
                      initial={{
                        opacity: 0,
                        x: slide > 0 ? 14 : -14,
                      }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{
                        opacity: 0,
                        x: slide > 0 ? -14 : 14,
                      }}
                      transition={{
                        duration: 0.18,
                        ease: DIALOG_EASE,
                      }}
                      className="grid grid-cols-7 gap-y-1"
                    >
                      {cells.map((day, index) => {
                        if (!day) {
                          return <span key={`pad-${index}`} className="h-9" />;
                        }

                        const isStart = isSameDay(day, draft.start);
                        const isEnd = isSameDay(day, draft.end);
                        const isEdge = isStart || isEnd;
                        const inRange =
                          !isEdge &&
                          painted.start &&
                          painted.end &&
                          day > painted.start &&
                          day < painted.end;
                        const isToday = isSameDay(day, today);

                        return (
                          <button
                            key={day.toDateString()}
                            type="button"
                            onClick={() => pickDay(day)}
                            onMouseEnter={() => setHover(day)}
                            onFocus={() => setHover(day)}
                            aria-label={formatDate(day)}
                            aria-pressed={isEdge}
                            aria-current={isToday ? "date" : undefined}
                            className={cn(
                              "flex h-9 items-center justify-center text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
                              isEdge
                                ? cn(
                                    "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
                                    isStart && "rounded-l-lg",
                                    isEnd && "rounded-r-lg",
                                  )
                                : inRange
                                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                  : "rounded-full text-[var(--ink)] hover:bg-[var(--surface-2)]",
                              !isEdge &&
                                isToday &&
                                "ring-1 ring-inset ring-[var(--accent)]/40",
                            )}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-4">
              <Button type="button" variant="outline" onClick={reset}>
                <RotateCcw size={14} aria-hidden /> Reset
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => close()}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  onClick={draftComplete ? apply : clearRange}
                  disabled={!draftComplete && !canClear}
                >
                  {canClear ? "Show all dates" : "Apply"}
                </Button>
              </div>
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default DateRangePicker;
