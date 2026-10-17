import {
  addDays,
  formatDate,
  formatDateRange,
  formatMoney,
  matchesDayRange,
  startOfDay,
  toDate,
  toMoney,
} from "./utils";
import { SOURCE_STATUS, TRANSACTION_KIND_META } from "../constants";

/* ── Reports engine (AdminReports) ────────────────────────────────────────
   Pure builders that turn the unified ledger plus the supporting lists
   (sources of funds, employees, audit entries) into exactly what the report
   cards, the preview modal, the print document and the CSV export render.
   Every builder emits pre-formatted display strings, so the page, the
   preview and the export can never disagree — the same "what you see is
   what you get" contract as lib/reportExport.js. */

export const ALL_FILTER = "all";

// Ledger previews stay light: the modal renders at most this many rows while
// the CSV/print path always carries the full result set.
export const PREVIEW_ROW_CAP = 120;
export const AUDIT_ROW_CAP = 200;

export const KIND_ORDER = [
  "budget",
  "issued",
  "expense",
  "abono",
  "transfer_sent",
  "transfer_received",
];

// One theme token per money leg — mirrors ReportTraceChart's palette so the
// catalog charts, the trace chart and the previews stay one visual language.
export const KIND_COLORS = {
  budget: "var(--ink)",
  issued: "var(--accent)",
  expense: "var(--warning)",
  abono: "var(--success)",
  transfer_sent: "var(--danger)",
  transfer_received: "var(--success)",
};

// Category donut / ranked-bar palette.
export const CHART_PALETTE = [
  "var(--accent)",
  "var(--warning)",
  "var(--success)",
  "var(--danger)",
  "var(--accent-strong)",
  "var(--ink-muted)",
];

const money = (value) => formatMoney(value);
const int = (value) => String(Number(value) || 0);
const titleCase = (value) =>
  value ? `${String(value)[0].toUpperCase()}${String(value).slice(1)}` : "—";

export const kindLabel = (kind) =>
  TRANSACTION_KIND_META[kind]?.label ?? kind ?? "—";

export const kindColor = (kind) => KIND_COLORS[kind] ?? "var(--accent)";

/* ── Range + scope primitives ───────────────────────────────────────────── */

/** Human label for the active picker range — "All time" when unset. */
export function rangeLabel(range) {
  if (!range?.start || !range?.end) return "All time";
  return formatDateRange(range, "All time");
}

/** The page's single filter pipeline: day range + source + record type. */
export function scopeRows(rows, { range, referenceId, kind } = {}) {
  return (rows ?? []).filter((row) => {
    if (!matchesDayRange(row.date, range?.start, range?.end)) return false;
    if (
      referenceId &&
      referenceId !== ALL_FILTER &&
      row.referenceId !== referenceId
    )
      return false;
    if (kind && kind !== ALL_FILTER && row.kind !== kind) return false;
    return true;
  });
}

/** Headline range totals — money in / out / net plus the record count. */
export function sumRows(rows) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const row of rows ?? []) {
    moneyIn += Number(row.moneyIn) || 0;
    moneyOut += Number(row.moneyOut) || 0;
  }
  moneyIn = toMoney(moneyIn);
  moneyOut = toMoney(moneyOut);
  return {
    moneyIn,
    moneyOut,
    net: toMoney(moneyIn - moneyOut),
    count: (rows ?? []).length,
  };
}

/** The same-length window immediately before `range` (for delta badges). */
export function previousWindow(range) {
  const start = toDate(range?.start);
  const end = toDate(range?.end);
  if (!start || !end) return null;
  const days = Math.max(
    1,
    Math.round((startOfDay(end) - startOfDay(start)) / 86_400_000) + 1,
  );
  const prevEnd = addDays(startOfDay(start), -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { start: prevStart, end: prevEnd };
}

/** Signed percentage change, 1-decimal. `null` when there is no baseline. */
export function pctDelta(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/* ── Series builders (charts + sparklines) ──────────────────────────────── */

/** One `{ v }` bucket per active day, oldest first — StatCard sparklines. */
export function dailySeries(rows, measure) {
  const byDay = new Map();
  for (const row of rows ?? []) {
    const day = toDate(row.date);
    if (!day) continue;
    const key = startOfDay(day).getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + (measure ? measure(row) : 0));
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => ({ v: toMoney(value) }));
}

/** Monthly money-flow buckets — the Financial Summary preview chart. */
export function monthlySeries(rows) {
  const byMonth = new Map();
  for (const row of rows ?? []) {
    const day = toDate(row.date);
    if (!day) continue;
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { in: 0, out: 0, count: 0 };
    bucket.in += Number(row.moneyIn) || 0;
    bucket.out += Number(row.moneyOut) || 0;
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, bucket]) => {
      const [year, month] = key.split("-");
      const monthName = new Date(
        Number(year),
        Number(month) - 1,
        1,
      ).toLocaleDateString("en-US", { month: "short" });
      return {
        month: key,
        label: `${monthName} '${year.slice(2)}`,
        in: toMoney(bucket.in),
        out: toMoney(bucket.out),
        net: toMoney(bucket.in - bucket.out),
        count: bucket.count,
      };
    });
}

/* ── Breakdowns (page panels + report tables) ───────────────────────────── */

/** Per-kind aggregates — records, money in, money out, total moved. */
export function kindBreakdown(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const entry = map.get(row.kind) ?? {
      kind: row.kind,
      count: 0,
      in: 0,
      out: 0,
    };
    entry.count += 1;
    entry.in += Number(row.moneyIn) || 0;
    entry.out += Number(row.moneyOut) || 0;
    map.set(row.kind, entry);
  }
  return KIND_ORDER.filter((kind) => map.has(kind))
    .map((kind) => {
      const entry = map.get(kind);
      const inTotal = toMoney(entry.in);
      const outTotal = toMoney(entry.out);
      return {
        kind,
        label: kindLabel(kind),
        color: kindColor(kind),
        count: entry.count,
        in: inTotal,
        out: outTotal,
        total: toMoney(inTotal + outTotal),
      };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

/** Paid expense totals grouped by category, biggest first. */
export function categoryBreakdown(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    if (row.kind !== "expense" || row.status !== "paid") continue;
    const name = row.categoryName || "Uncategorized";
    const entry = map.get(name) ?? { name, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(row.amount) || 0;
    map.set(name, entry);
  }
  const list = [...map.values()]
    .map((entry) => ({ ...entry, total: toMoney(entry.total) }))
    .sort((a, b) => b.total - a.total);
  const grand = toMoney(list.reduce((sum, entry) => sum + entry.total, 0));
  return list.map((entry, index) => ({
    key: entry.name,
    name: entry.name,
    count: entry.count,
    total: entry.total,
    share: grand > 0 ? Math.round((entry.total / grand) * 1000) / 10 : 0,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
  }));
}

const SYSTEM_KEY = "__system";

/**
 * Per-person aggregates from the filtered ledger. Budget rows carry no
 * employee — they stack into a "System" bucket under the approving admin's
 * name, mirroring how the ledger itself attributes them.
 */
export function employeeBreakdown(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = row.employeeId || SYSTEM_KEY;
    const entry = map.get(key) ?? {
      key,
      name: row.employeeName || row.approvedBy || "System",
      role: row.employeeRole ?? (key === SYSTEM_KEY ? "admin" : null),
      count: 0,
      issued: 0,
      spent: 0,
      abono: 0,
      sent: 0,
      received: 0,
    };
    entry.count += 1;
    if (row.kind === "issued") entry.issued += Number(row.moneyOut) || 0;
    if (row.kind === "expense") entry.spent += Number(row.moneyOut) || 0;
    if (row.kind === "abono") entry.abono += Number(row.moneyIn) || 0;
    if (row.kind === "transfer_sent") entry.sent += Number(row.moneyOut) || 0;
    if (row.kind === "transfer_received")
      entry.received += Number(row.moneyIn) || 0;
    map.set(key, entry);
  }
  return [...map.values()]
    .map((entry) => {
      const issued = toMoney(entry.issued);
      const spent = toMoney(entry.spent);
      const abono = toMoney(entry.abono);
      const sent = toMoney(entry.sent);
      const received = toMoney(entry.received);
      return {
        ...entry,
        issued,
        spent,
        abono,
        sent,
        received,
        // What is still effectively held by the person: everything handed in
        // minus everything paid out — the same definition the employee
        // ledgers use for available balance.
        net: toMoney(issued + received + abono - spent - sent),
        total: toMoney(issued + spent + abono + sent + received),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Current all-time standing per source of funds (live aggregates). */
export function sourceBreakdown(sources) {
  return (sources ?? [])
    .map((source) => {
      const allocated = Number(source.allocated) || 0;
      const issued = Number(source.issued) || 0;
      const spent = Number(source.expenses) || 0;
      const remaining = Number(source.remaining) || 0;
      const status = source.status ?? "open";
      return {
        key: source.reference_id,
        label: source.label || "Untitled source",
        status,
        statusLabel: SOURCE_STATUS[status]?.label ?? "Open",
        allocated,
        issued,
        spent,
        remaining,
        utilization:
          allocated > 0
            ? Math.round(((issued + spent) / allocated) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.allocated - a.allocated);
}

/** Audit entries ranked by action — the Audit Trail preview's bar chart. */
export function actionBars(logs, limit = 6) {
  const counts = new Map();
  for (const entry of logs ?? []) {
    const action = entry.action || "unknown";
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([action, count]) => ({
      key: action,
      label: titleCase(action),
      value: count,
    }));
}

/* ── Report payloads ────────────────────────────────────────────────────── */
// Each: { summaryRows: [[label, value]], columns: [{ key, label }],
//         records: [{ key: "display string" }], csvRecords?, totalOut?,
//         totalOutLabel? } — rows are cells for the modal/print, records are
//         the CSV source (already display-formatted).

export function financialReport(rows, range) {
  const totals = sumRows(rows);
  const kinds = kindBreakdown(rows);
  const average =
    totals.count > 0
      ? toMoney((totals.moneyIn + totals.moneyOut) / totals.count)
      : 0;
  return {
    summaryRows: [
      ["Date range", rangeLabel(range)],
      ["Records", int(totals.count)],
      ["Money in", money(totals.moneyIn)],
      ["Money out", money(totals.moneyOut)],
      ["Net position", money(totals.net)],
      ["Average value / record", money(average)],
    ],
    columns: [
      { key: "label", label: "Type" },
      { key: "count", label: "Records" },
      { key: "in", label: "Money in" },
      { key: "out", label: "Money out" },
      { key: "net", label: "Net" },
    ],
    records: kinds.map((kind) => ({
      label: kind.label,
      count: int(kind.count),
      in: money(kind.in),
      out: money(kind.out),
      net: money(toMoney(kind.in - kind.out)),
    })),
    totalOut: totals.moneyOut,
    totalOutLabel: "total out",
  };
}

const ledgerRecord = (row) => ({
  date: formatDate(row.date),
  type: kindLabel(row.kind),
  description: row.description || "—",
  employee: row.employeeName || row.approvedBy || "System",
  source: row.referenceLabel || "—",
  in: Number(row.moneyIn) > 0 ? money(row.moneyIn) : "—",
  out: Number(row.moneyOut) > 0 ? money(row.moneyOut) : "—",
});

export function ledgerReport(rows, range) {
  const totals = sumRows(rows);
  const list = rows ?? [];
  const shown = list.slice(0, PREVIEW_ROW_CAP);
  return {
    summaryRows: [
      ["Date range", rangeLabel(range)],
      ["Records", int(totals.count)],
      ["Money in", money(totals.moneyIn)],
      ["Money out", money(totals.moneyOut)],
      ["Net position", money(totals.net)],
      ...(list.length > PREVIEW_ROW_CAP
        ? [
            [
              "Preview",
              `First ${PREVIEW_ROW_CAP} of ${list.length} shown — CSV carries the full ledger`,
            ],
          ]
        : []),
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "employee", label: "Employee" },
      { key: "source", label: "Source of funds" },
      { key: "in", label: "Money in" },
      { key: "out", label: "Money out" },
    ],
    records: shown.map(ledgerRecord),
    csvRecords: list.map(ledgerRecord),
    totalOut: totals.moneyOut,
    totalOutLabel: "total out",
  };
}

export function expenseReport(rows, range) {
  const expenseRows = (rows ?? []).filter((row) => row.kind === "expense");
  const paid = expenseRows.filter((row) => row.status === "paid");
  const parked = expenseRows.filter((row) => row.status !== "paid");
  const totalSpent = toMoney(
    paid.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );
  const parkedTotal = toMoney(
    parked.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );
  const scanned = expenseRows.filter(
    (row) => row.receiptId || row.imageUrl,
  ).length;
  const flagged = expenseRows.filter((row) => row.flagged).length;
  const largest = paid.reduce(
    (max, row) => Math.max(max, Number(row.amount) || 0),
    0,
  );
  const average = paid.length > 0 ? toMoney(totalSpent / paid.length) : 0;
  const scanShare =
    expenseRows.length > 0
      ? Math.round((scanned / expenseRows.length) * 100)
      : 0;
  const categories = categoryBreakdown(rows);
  return {
    summaryRows: [
      ["Date range", rangeLabel(range)],
      ["Expense records", int(expenseRows.length)],
      ["Total spent (paid)", money(totalSpent)],
      ["Average expense", money(average)],
      ["Largest expense", money(largest)],
      ["Scanned receipts", `${scanned} of ${expenseRows.length} · ${scanShare}%`],
      ["Flagged for review", int(flagged)],
      ["Parked (draft / cancelled)", `${parked.length} · ${money(parkedTotal)}`],
    ],
    columns: [
      { key: "category", label: "Category" },
      { key: "count", label: "Records" },
      { key: "total", label: "Total spent" },
      { key: "avg", label: "Average" },
      { key: "share", label: "Share" },
    ],
    records: categories.map((category) => ({
      category: category.name,
      count: int(category.count),
      total: money(category.total),
      avg: money(category.count > 0 ? category.total / category.count : 0),
      share: `${category.share}%`,
    })),
    totalOut: totalSpent,
    totalOutLabel: "total spent",
  };
}

export function sourceReport(sourceRows) {
  const list = sourceRows ?? [];
  const open = list.filter((source) => source.status === "open");
  const totals = list.reduce(
    (acc, source) => ({
      allocated: acc.allocated + source.allocated,
      issued: acc.issued + source.issued,
      spent: acc.spent + source.spent,
      remaining: acc.remaining + source.remaining,
    }),
    { allocated: 0, issued: 0, spent: 0, remaining: 0 },
  );
  const deployed = totals.issued + totals.spent;
  const utilization =
    totals.allocated > 0
      ? Math.round((deployed / totals.allocated) * 1000) / 10
      : 0;
  return {
    summaryRows: [
      ["Scope", "Live standing — every source, all time"],
      ["Sources", `${list.length} total · ${open.length} open`],
      ["Allocated", money(totals.allocated)],
      ["Issued to employees", money(totals.issued)],
      ["Spent from sources", money(totals.spent)],
      ["Remaining balance", money(totals.remaining)],
      ["Deployment", `${utilization}%`],
    ],
    columns: [
      { key: "label", label: "Source" },
      { key: "status", label: "Status" },
      { key: "allocated", label: "Allocated" },
      { key: "issued", label: "Issued" },
      { key: "spent", label: "Spent" },
      { key: "remaining", label: "Remaining" },
      { key: "utilization", label: "Deployed" },
    ],
    records: list.map((source) => ({
      label: source.label,
      status: source.statusLabel,
      allocated: money(source.allocated),
      issued: money(source.issued),
      spent: money(source.spent),
      remaining: money(source.remaining),
      utilization: `${source.utilization}%`,
    })),
    totalOut: totals.spent,
    totalOutLabel: "total spent",
  };
}

export function employeeReport(rows, range, staff = null) {
  const people = employeeBreakdown(rows);
  const totals = people.reduce(
    (acc, person) => ({
      issued: acc.issued + person.issued,
      spent: acc.spent + person.spent,
      abono: acc.abono + person.abono,
      sent: acc.sent + person.sent,
      received: acc.received + person.received,
      net: acc.net + person.net,
    }),
    { issued: 0, spent: 0, abono: 0, sent: 0, received: 0, net: 0 },
  );
  return {
    summaryRows: [
      ["Date range", rangeLabel(range)],
      ["People involved", int(people.length)],
      ...(staff
        ? [
            [
              "Employee accounts",
              `${staff.activeEmployees} active · ${staff.pendingApproval} pending · ${staff.totalEmployees} total`,
            ],
          ]
        : []),
      ["Issued to employees", money(totals.issued)],
      ["Spent on expenses", money(totals.spent)],
      ["Abono recorded", money(totals.abono)],
      ["Transfers between employees", money(totals.sent)],
      ["Net held by employees", money(totals.net)],
    ],
    columns: [
      { key: "name", label: "Employee" },
      { key: "role", label: "Role" },
      { key: "count", label: "Records" },
      { key: "issued", label: "Issued" },
      { key: "spent", label: "Spent" },
      { key: "abono", label: "Abono" },
      { key: "received", label: "Transfers in" },
      { key: "sent", label: "Transfers out" },
      { key: "net", label: "Net held" },
    ],
    records: people.map((person) => ({
      name: person.name,
      role: titleCase(person.role),
      count: int(person.count),
      issued: money(person.issued),
      spent: money(person.spent),
      abono: money(person.abono),
      received: money(person.received),
      sent: money(person.sent),
      net: money(person.net),
    })),
    totalOut: totals.spent,
    totalOutLabel: "total spent",
  };
}

export function auditReport(logs, range, total = null) {
  const inRange = (logs ?? []).filter((entry) =>
    matchesDayRange(entry.timestamp, range?.start, range?.end),
  );
  const shown = inRange.slice(0, AUDIT_ROW_CAP);
  const eventCount = Number.isFinite(total) ? total : inRange.length;
  const admins = inRange.filter((entry) => entry.role === "admin").length;
  const employees = inRange.filter((entry) => entry.role === "employee").length;
  const actions = actionBars(inRange, 1);
  return {
    summaryRows: [
      ["Date range", rangeLabel(range)],
      ["Events", int(eventCount)],
      ["By admins", int(admins)],
      ["By employees", int(employees)],
      ["Top action", actions[0] ? `${actions[0].label} · ${actions[0].value}` : "—"],
      ...(eventCount > shown.length
        ? [
            [
              "Preview",
              `Most recent ${shown.length} of ${eventCount} events shown`,
            ],
          ]
        : []),
    ],
    columns: [
      { key: "time", label: "Time" },
      { key: "action", label: "Action" },
      { key: "entity", label: "Entity" },
      { key: "actor", label: "Actor" },
      { key: "role", label: "Role" },
      { key: "amount", label: "Amount" },
      { key: "details", label: "Details" },
    ],
    records: shown.map((entry) => ({
      time: entry.display ?? formatDate(entry.timestamp),
      action: titleCase(entry.action),
      entity: titleCase(entry.entity),
      actor: entry.actorName || "System",
      role: titleCase(entry.role),
      amount: entry.amount ?? "—",
      details: entry.details || "—",
    })),
    totalOut: null,
  };
}
