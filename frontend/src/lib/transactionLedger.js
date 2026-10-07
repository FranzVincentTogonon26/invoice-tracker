import { TRANSACTION_KIND_META, SYSTEM_EMPLOYEE_VALUE } from "@/constants";
import { methodLabel, startOfDay, toDate } from "@/lib/utils";

export const DAY_MS = 86_400_000;

export const rowDay = (row) => toDate(row?.date);

export const countDays = (start, end) =>
  Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;

export const shortRangeLabel = (range) => {
  if (!range?.start || !range?.end) return "";
  const crossYear = range.start.getFullYear() !== range.end.getFullYear();
  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(crossYear ? { year: "numeric" } : {}),
    });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
};

export const rowsWindow = (rows) => {
  let start = null;
  let end = null;
  for (const row of rows) {
    const day = rowDay(row);
    if (!day) continue;
    const mid = startOfDay(day);
    if (!start || mid < start) start = mid;
    if (!end || mid > end) end = mid;
  }
  return start && end ? { start, end } : null;
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
    if (!day) continue;
    const mid = startOfDay(day);
    if (mid < start || mid > end) continue;
    totals[Math.floor((countDays(start, mid) - 1) / bucketDays)] +=
      measure(row);
  }
  return totals.map((v) => ({ v }));
};

export const matchesTypeTab = (row, tab) => {
  if (tab === "all") return true;
  if (tab === "transfer")
    return row.kind === "transfer_sent" || row.kind === "transfer_received";
  return row.kind === tab;
};

export const matchesFilters = (row, draft, query) => {
  if (!matchesTypeTab(row, draft.type)) return false;
  if (draft.direction !== "all" && row.direction !== draft.direction)
    return false;
  if (draft.employee !== "all") {
    if (draft.employee === SYSTEM_EMPLOYEE_VALUE) {
      if (row.employeeId) return false;
    } else if (row.employeeId !== draft.employee) return false;
  }
  if (draft.reference !== "all") {
    const val = row.referenceId ?? `label:${row.referenceLabel}`;
    if (val !== draft.reference) return false;
  }
  if (draft.category !== "all" && row.categoryId !== draft.category)
    return false;
  if (draft.status !== "all" && row.status !== draft.status) return false;
  if (!query) return true;
  return [
    row.description,
    row.notes,
    row.employeeName,
    row.counterpartyName,
    row.referenceLabel,
    row.categoryName,
    row.approvedBy,
    row.method ? methodLabel(row.method) : "",
    TRANSACTION_KIND_META[row.kind]?.label,
    row.direction === "in"
      ? "money in"
      : row.direction === "out"
        ? "money out"
        : "",
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(query));
};
