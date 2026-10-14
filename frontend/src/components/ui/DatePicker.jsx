import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  cn,
  formatDate,
  getMonthGrid,
  isSameDay,
  startOfDay,
  startOfMonth,
  toISODate,
} from "@/lib/utils";
import { Button } from "./Button";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function normalizeDay(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : startOfDay(d);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      );
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : startOfDay(d);
  }
  return null;
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
export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  align = "start",
  // Earliest selectable day (same value contract as `value`) — earlier
  // days render muted and cannot be picked. Omitted → no lower bound.
  minDate,
  className,
  disabled = false,
  // Hover tooltip for the trigger — the Add Expenses form uses it to explain a
  // warning state (a date behind the budget issued to the user) without
  // lengthening the label.
  title,
}) {
  const [open, setOpen] = useState(false);
  // Fixed viewport position for the portaled calendar (set on open from the
  // trigger rect) — the panel lives on document.body so no overflow ancestor
  // (e.g. a modal scrollport) can clip it, no matter the z-index.
  const [position, setPosition] = useState(null);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(normalizeDay(value) ?? new Date()),
  );
  const [slide, setSlide] = useState(1);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const today = useMemo(() => startOfDay(), []);
  const selected = useMemo(() => normalizeDay(value), [value]);
  const minDay = useMemo(() => normalizeDay(minDate), [minDate]);
  const cells = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);
  const label = selected ? formatDate(selected) : placeholder;
  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPosition(null);
    if (refocus) triggerRef.current?.focus();
  }, []);
  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Panel width mirrors the w-[min(92vw,320px)] class below; flip above
      // the trigger when there is no room below.
      const panelWidth = Math.min(window.innerWidth * 0.92, 320);
      const panelHeight = 460;
      const gap = 8;
      const fitsBelow =
        rect.bottom + gap + panelHeight <= window.innerHeight;
      const top = fitsBelow
        ? rect.bottom + gap
        : Math.max(8, rect.top - gap - panelHeight);
      const rawLeft =
        align === "end" ? rect.right - panelWidth : rect.left;
      const left = Math.max(
        8,
        Math.min(rawLeft, window.innerWidth - panelWidth - 8),
      );
      setPosition({ top, left, width: panelWidth });
    }
    setViewMonth(startOfMonth(normalizeDay(value) ?? new Date()));
    setSlide(1);
    setOpen(true);
  };
  const toggle = () => (open ? close() : openPanel());
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (
        !rootRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      )
        close(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    // Same contract as RowMenu: scrolling or resizing dismisses the floating
    // panel instead of leaving it stranded mid-viewport.
    const onViewportChange = () => close(false);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewportChange, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, {
        capture: true,
      });
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, close]);
  const shiftMonth = (amount) => {
    setSlide(amount);
    setViewMonth((current) => addMonths(current, amount));
  };
  const pickDay = (day) => {
    onChange?.(toISODate(startOfDay(day)));
    close();
  };
  const clear = () => {
    onChange?.("");
    close();
  };
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Date: ${label}`}
        title={title}
        className={cn(
          "flex font-medium h-10 w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-5 pr-4 text-sm tabular-nums outline-none transition-colors",
          "hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15",
          "disabled:opacity-50",
          open && "border-[var(--accent)]/50 ring-2 ring-[var(--accent)]/15",
          selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
          className,
        )}
      >
        <span className="shrink-0 text-[var(--ink-muted)]">
          <CalendarDays size={16} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.div
              key="date-panel"
              ref={panelRef}
              role="dialog"
              aria-label="Select date"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: DIALOG_EASE }}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
              }}
              className="z-[9999999] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover"
            >
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
              <span className="font-display text-lg font-medium tracking-tight text-[var(--ink)]">
                Date
              </span>
              <span className="truncate text-sm font-medium text-[var(--ink-muted)]">
                {selected ? formatDate(selected) : "Pick a date"}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between">
                <NavButton
                  label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft size={16} aria-hidden />
                </NavButton>
                <span className="text-sm font-medium text-[var(--ink)]">
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
                    initial={{ opacity: 0, x: slide > 0 ? 14 : -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: slide > 0 ? -14 : 14 }}
                    transition={{ duration: 0.18, ease: DIALOG_EASE }}
                    className="grid grid-cols-7 gap-y-1"
                  >
                    {cells.map((day, index) => {
                      if (!day)
                        return <span key={`pad-${index}`} className="h-9" />;
                      const isSelected = isSameDay(day, selected);
                      const isToday = isSameDay(day, today);
                      const isTooEarly =
                        minDay != null && startOfDay(day) < minDay;
                      return (
                        <button
                          key={day.toDateString()}
                          type="button"
                          onClick={() => pickDay(day)}
                          disabled={isTooEarly}
                          aria-label={formatDate(day)}
                          aria-pressed={isSelected}
                          aria-current={isToday ? "date" : undefined}
                          aria-disabled={isTooEarly || undefined}
                          className={cn(
                            "flex h-9 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
                            isTooEarly
                              ? "cursor-not-allowed text-[var(--ink-muted)] opacity-30"
                              : isSelected
                                ? "bg-[var(--accent)] font-medium text-white hover:bg-[var(--accent-strong)]"
                                : "text-[var(--ink)] hover:bg-[var(--surface-2)]",
                            !isTooEarly &&
                              !isSelected &&
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
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={clear}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => pickDay(today)}
                >
                  Select today
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

export default DatePicker;
