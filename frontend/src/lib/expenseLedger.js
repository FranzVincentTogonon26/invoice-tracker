import { startOfDay, toDate } from "@/lib/utils";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const emptyRange = () => ({ start: null, end: null });

export const dayOf = (value) => {
  const parsed = toDate(value);
  return parsed ? startOfDay(parsed) : null;
};

export const rowDay = (row) => dayOf(row?.expense_date ?? row?.date);

export const matchesDayRange = (value, start, end) => {
  const day = dayOf(value);
  if (!day) return true;
  if (start && day < startOfDay(start)) return false;
  if (end && day > startOfDay(end)) return false;
  return true;
};

export const matchesLedgerFilters = (
  row,
  { category, employee, method, status, query },
) => {
  if (employee && employee !== "all" && row.employeeId !== employee)
    return false;
  if (category !== "all" && row.categoryId !== category) return false;
  if (method !== "all" && row.method !== method) return false;
  if (status !== "all" && row.status !== status) return false;
  if (!query) return true;

  return [row.description, row.category, row.employee, row.method]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(query));
};

export const countDays = (start, end) =>
  Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;

export const shortRangeLabel = (range) => {
  if (!range?.start || !range?.end) return "";

  const withYear = range.start.getFullYear() !== range.end.getFullYear();

  const format = (day) =>
    day.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });

  return `${format(range.start)} - ${format(range.end)}`;
};

export const buildRangeSeries = (range, rows, measure) => {
  const start = range?.start ? startOfDay(range.start) : null;
  const end = range?.end ? startOfDay(range.end) : null;

  if (!start || !end || end < start) return [];

  const days = countDays(start, end);
  const bucketDays = days <= 14 ? 1 : Math.ceil(days / 14);
  const totals = new Array(Math.ceil(days / bucketDays)).fill(0);

  for (const row of rows) {
    const day = rowDay(row);

    if (!day || day < start || day > end) continue;

    const bucket = Math.floor((countDays(start, day) - 1) / bucketDays);

    totals[bucket] += measure(row);
  }

  return totals.map((v) => ({ v }));
};

export const rowsWindow = (rows) => {
  let start = null;
  let end = null;

  for (const row of rows) {
    const day = rowDay(row);

    if (!day) continue;
    if (!start || day < start) start = day;
    if (!end || day > end) end = day;
  }

  return start && end ? { start, end } : null;
};
