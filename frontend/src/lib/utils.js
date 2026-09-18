import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount, currency = "PHP") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)}`;
  }
}

export function relativeTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function formatDate(date) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* -------------------------------------------------------------------------- */
/* Date-range helpers (used by the DateRangePicker and its consumers)          */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes a value into a valid `Date`, or `null` when it can't be parsed.
 * Strings/numbers are passed through the `Date` constructor.
 */
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    // Date-only strings are parsed as UTC per spec ("2026-09-01"), which would
    // show the previous day west of UTC — build those in local time instead.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      );
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Local-midnight copy of `date` (defaults to now). All range math goes through
 * this so comparisons stay timezone/DST safe — `toISOString()` would shift the
 * day for anyone east/west of UTC.
 */
export function startOfDay(date) {
  const d = toDate(date) ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * `YYYY-MM-DD` for a local calendar day (defaults to today) — the shape native
 * date inputs emit and the expense form persists. Composed from local parts on
 * purpose: `toISOString()` would shift the day for anyone east/west of UTC.
 */
export function toISODate(date = new Date()) {
  const d = startOfDay(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First day of the month containing `date` (defaults to now), at midnight. */
export function startOfMonth(date) {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last day of the month containing `date` (defaults to now), at midnight. */
export function endOfMonth(date) {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Midnight of the first day of the month `amount` months away from `date`. */
export function addMonths(date, amount) {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth() + amount, 1);
}

/** Midnight `amount` days away from `date` (negative values go back). */
export function addDays(date, amount) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + amount);
  return d;
}

/** True when both dates fall on the same calendar day (local time). */
export function isSameDay(a, b) {
  const d1 = toDate(a);
  const d2 = toDate(b);
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Full calendar month around `date` (defaults to now) → `{ start, end }`. */
export function monthRange(date) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

/**
 * Fixed 42-cell (6 weeks, Sunday-first) grid for the month containing `month`.
 * Each day is a local-midnight `Date`; padding cells are `null` so every month
 * renders the same number of rows.
 */
export function getMonthGrid(month) {
  const first = startOfMonth(month);
  const year = first.getFullYear();
  const monthIndex = first.getMonth();
  const daysInMonth = endOfMonth(first).getDate();

  const cells = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

/**
 * "Sep. 1, 2026" — the abbreviated, period-suffixed month style the Expenses
 * toolbar uses. `toLocaleDateString` drops the period, so the parts are
 * composed by hand.
 */
function formatDay(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("month").replace(/\.$/, "")}. ${part("day")}, ${part("year")}`;
}

/**
 * Human-readable label for a `{ start, end }` range, e.g.
 * "Sep. 1, 2026 - Sep. 30, 2026". Falls back to `fallback` while either end is
 * missing, so the picker trigger can render a placeholder.
 */
export function formatDateRange(range, fallback = "Select date range") {
  const start = toDate(range?.start);
  const end = toDate(range?.end);
  if (!start || !end) return fallback;
  return `${formatDay(start)} - ${formatDay(end)}`;
}

/**
 * Applies a day click to a `{ start, end }` draft range — the picker's
 * two-click flow:
 *   - nothing selected        → the day becomes the start
 *   - start but no end        → the day becomes the end (swapped if earlier)
 *   - the same day again      → a single-day range
 *   - a complete range        → clicking restarts a fresh selection
 * Both ends come back normalized to local midnight.
 */
export function selectRangeDay(draft, day) {
  const picked = startOfDay(day);
  const start = draft?.start ? startOfDay(draft.start) : null;
  const end = draft?.end ? startOfDay(draft.end) : null;

  if (!start || end) return { start: picked, end: null };
  if (picked < start) return { start: picked, end: start };
  return { start, end: picked };
}

/**
 * Range to highlight in the calendar: the draft once it's complete, or
 * start → hover while the end is still open (the live hover preview).
 */
export function rangeWithPreview(draft, hover) {
  const start = draft?.start ? startOfDay(draft.start) : null;
  const end = draft?.end ? startOfDay(draft.end) : null;

  if (!start || end || !hover) return { start, end };
  const pointed = startOfDay(hover);
  return pointed < start
    ? { start: pointed, end: start }
    : { start, end: pointed };
}
