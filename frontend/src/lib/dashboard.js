import { HandCoins, Plus, ReceiptText, Wallet } from "lucide-react";

// The dashboard's shared scope key: the source picker's "combined view".
export const ALL_SOURCES = "all";

export const CHART_EASE = [0.16, 1, 0.3, 1];

// ExpenseOverview-style staggered entrance for the stat strip.
export const statContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};

export const statItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: CHART_EASE },
  },
};

// Series palette — one theme token per money leg, reused by the chart, the
// stat strip and the tooltip so the four figures stay identifiable. `tone`
// drives the shared StatCard's icon/value tint; `caption` is the context
// line under each big figure; `deltaPolarity` tints the latest-move badge
// (money-in legs read up as good, money-out legs as caution).
export const SERIES = [
  {
    key: "cumAllocated",
    totalKey: "allocated",
    label: "Allocated",
    color: "var(--accent)",
    Icon: Plus,
    caption: "Total budget in",
    deltaPolarity: "up-good",
    pick: (row) => (row.kind === "budget" ? Number(row.moneyIn) || 0 : 0),
  },
  {
    key: "cumIssued",
    totalKey: "issued",
    label: "Issued",
    color: "var(--warning)",
    tone: "warning",
    Icon: HandCoins,
    caption: "Handed out",
    deltaPolarity: "up-bad",
    pick: (row) => (row.kind === "issued" ? Number(row.moneyOut) || 0 : 0),
  },
  {
    key: "cumSpent",
    totalKey: "spent",
    label: "Spent",
    color: "var(--danger)",
    tone: "danger",
    Icon: ReceiptText,
    caption: "Expenses logged",
    deltaPolarity: "up-bad",
    pick: (row) => (row.kind === "expense" ? Number(row.moneyOut) || 0 : 0),
  },
  {
    key: "cumAbono",
    totalKey: "abono",
    label: "Abono",
    color: "var(--success)",
    tone: "success",
    Icon: Wallet,
    caption: "Returns recorded",
    deltaPolarity: "up-good",
    pick: (row) => (row.kind === "abono" ? Number(row.moneyIn) || 0 : 0),
  },
];

// Compact peso ticks keep long figures from crowding the axis edge.
export const compactPeso = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toFixed(0)}`;
};

export const shortDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
