import { EXPENSES_TYPE_CONFIG } from "@/constants";
import {
  addDays,
  isSameDay,
  matchesDayRange as matchesUtilsDayRange,
  methodLabel,
  startOfDay,
  toDate,
} from "@/lib/utils";

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

// ── Employee expenses section (All Expenses) ─────────────────────────
// Pure row helpers for the employee expenses feed (issued / expense /
// abono). Same shapes as the overview ledger — camelCase from the modal,
// snake_case from the feed — so every predicate accepts both.

// Short "20 Oct" date for the compact mobile meta row. Invalid dates render
// as "—", never "Invalid Date".
export const formatShortExpenseDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

export const expenseConfigFor = (kind) =>
  EXPENSES_TYPE_CONFIG[kind] ?? EXPENSES_TYPE_CONFIG.expense;

// Only expense rows open the mobile sheet — issuance/abono ledger entries
// carry no sheet lifecycle.
export const isExpenseActionable = (row) => row?.kind === "expense";

// Mirrors EmployeeExpenseDetailsModal: a receipt exists when the row links a
// receipt record or carries a stored receipt file URL (image or PDF).
// Accepts the feed's snake_case fields too.
export const hasExpenseReceipt = (row) =>
  Boolean(
    row?.receiptId ?? row?.receipt_id ?? row?.imageUrl ?? row?.image_url,
  );

// `expenses.flag = 1` means the backend saved this employee line as backdated
// (dated before the first budget issued to them). Accepts both the raw `flag`
// column and the mapped `flagged` boolean so desktop + mobile render from any
// shape the ledger passes in.
export const isExpenseFlagged = (row) =>
  row?.flagged === true || Number(row?.flag) === 1;

export const getExpenseDateGroupLabel = (date) => {
  const txDate = startOfDay(toDate(date));
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  if (isSameDay(txDate, today)) return "Today";
  if (isSameDay(txDate, yesterday)) return "Yesterday";
  return "Last days";
};

// Relative-day identifier for the desktop "Days" column — Today / Yesterday /
// Last days by calendar day (local time), mirroring the admin ledger. An
// unparseable date renders "—" instead of silently falling into Today
// (`startOfDay` would fold a bad value into now).
export const getExpenseDaysLabel = (date) => {
  if (!toDate(date)) return "—";
  const txDate = startOfDay(toDate(date));
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  if (isSameDay(txDate, today)) return "Today";
  if (isSameDay(txDate, yesterday)) return "Yesterday";
  return "Last days";
};

export const groupExpenseTransactionsByDate = (rows) => {
  const groups = new Map();
  const groupOrder = ["Today", "Yesterday", "Last days"];

  for (const tx of rows) {
    const label = getExpenseDateGroupLabel(tx.date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(tx);
  }

  return groupOrder
    .filter((label) => groups.has(label) && groups.get(label).length > 0)
    .map((label) => ({ label, transactions: groups.get(label) }));
};

export const filterExpenseSectionTransactions = (
  transactions,
  debouncedSearch,
  dateRange,
) => {
  const q = debouncedSearch.trim().toLowerCase();
  const { start, end } = dateRange ?? {};
  const inRange = (tx) => matchesUtilsDayRange(tx.date, start, end);
  if (!q) return transactions.filter(inRange);

  return transactions.filter((tx) => {
    if (!inRange(tx)) return false;
    const typeLabel = EXPENSES_TYPE_CONFIG[tx.kind]?.label?.toLowerCase() || "";
    const desc = (tx.description || "").toLowerCase();
    const refLabel = (tx.reference_label || "").toLowerCase();
    const notes = (tx.notes || "").toLowerCase();
    const method = methodLabel(tx.method || "").toLowerCase();
    const status = (tx.status || "").toLowerCase();
    const amountStr = String(tx.amount || "");
    const dayLabel = getExpenseDaysLabel(tx.date).toLowerCase();

    return (
      desc.includes(q) ||
      refLabel.includes(q) ||
      notes.includes(q) ||
      typeLabel.includes(q) ||
      method.includes(q) ||
      status.includes(q) ||
      dayLabel.includes(q) ||
      amountStr.includes(q)
    );
  });
};
