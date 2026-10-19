import { motion } from "framer-motion";
import {
  Check,
  Clock,
  ReceiptText,
  ScanLine,
  TrendingUp,
} from "lucide-react";
import { formatMoney } from "../../lib/utils";

/**
 * Infinite horizontal marquee of "product preview" cards for the auth panel.
 * Renders the card list twice and slides the row so the wrap-around is invisible.
 */
export function BrandCardMarquee() {
  const CARDS = [
    SourceCard,
    HeroBudgetCard,
    ExpensesCard,
    ReceiptCard,
    AbonoCard,
    LiquidationCard,
  ];
  const tilts = [-2, 1.5, -1, 2, -1.5, 1];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
    >
      <motion.div
        className="flex gap-5 py-4"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
      >
        {[...CARDS, ...CARDS].map((Card, i) => (
          <div
            key={i}
            className="shrink-0"
            style={{ transform: `rotate(${tilts[i % tilts.length]}deg)` }}
          >
            <Card />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Diagonal field of scrolling cards for the auth panel — three rows scrolling
 * horizontally inside a rotated block anchored to the lower-right, so the
 * preview cards appear to flow diagonally across the bottom-right half of the
 * panel. Every card mirrors a real Budget Tracker surface (source of funds,
 * budget hero, expense ledger, AI receipt scan, abono, liquidations) with the
 * app's own `formatMoney` peso formatting.
 */
export function DiagonalMarquee() {
  const rows = [
    { cards: [SourceCard, HeroBudgetCard, ExpensesCard], duration: 44, reverse: false },
    { cards: [ReceiptCard, AbonoCard, LiquidationCard], duration: 52, reverse: true },
    { cards: [HeroBudgetCard, ExpensesCard, SourceCard], duration: 48, reverse: false },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div
        className="absolute bottom-[-26%] right-[-34%] w-[175%]"
        style={{
          transform: "rotate(-24deg)",
          transformOrigin: "bottom right",
          maskImage: "linear-gradient(300deg, #000 30%, transparent 56%)",
          WebkitMaskImage: "linear-gradient(300deg, #000 30%, transparent 56%)",
        }}
      >
        <div className="flex flex-col gap-5">
          {rows.map((r, i) => (
            <MarqueeRow key={i} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({ cards, duration, reverse }) {
  const tripled = [...cards, ...cards, ...cards];
  const from = reverse ? "-33.333%" : "0%";
  const to = reverse ? "0%" : "-33.333%";
  return (
    <motion.div
      className="flex gap-5"
      animate={{ x: [from, to] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      {tripled.map((Card, i) => (
        <div key={i} className="shrink-0">
          <Card />
        </div>
      ))}
    </motion.div>
  );
}

/* ── Palette — pinned to the light-theme tokens in src/index.css so the
      preview cards read identically whatever theme the viewer uses. ──────── */
const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const TEAL_HERO_FROM = "#14b8a6";
const TEAL_SOFT = "#D3F4EC";
const AMBER_SOFT = "#FBF1E2";
const AMBER_DARK = "#B45309";
const ROSE_SOFT = "#FDE7EA";
const ROSE_DARK = "#BE123C";
const GRAY_SOFT = "#F3F4F6";
const GRAY_DARK = "#4B5563";

// Expense statuses — same labels/colors as the ledger's ExpenseStatusBadge.
const EXPENSE_STATUS = {
  paid: { label: "Paid", color: "#059669" },
  draft: { label: "Draft", color: "#d97706" },
  cancel: { label: "Cancelled", color: "#e11d48" },
};

function PreviewCard({ children, width = 300 }) {
  return (
    <div
      className="bg-white rounded-3xl p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
      style={{ width }}
    >
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div className="text-xs uppercase tracking-widest text-gray-400 font-medium">
      {children}
    </div>
  );
}

function Footer({ subtitle }) {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
      <span
        className="h-4 w-4 rounded-md"
        style={{ background: `linear-gradient(135deg,${TEAL},${TEAL_DARK})` }}
      />
      <span className="text-xs font-medium text-gray-700">
        {subtitle || "Budget Tracker"}
      </span>
    </div>
  );
}

function Pill({ children, tone = "teal" }) {
  const styles =
    tone === "teal"
      ? { background: TEAL_SOFT, color: TEAL_DARK }
      : tone === "amber"
        ? { background: AMBER_SOFT, color: AMBER_DARK }
        : tone === "rose"
          ? { background: ROSE_SOFT, color: ROSE_DARK }
          : { background: GRAY_SOFT, color: GRAY_DARK };
  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-normal"
      style={styles}
    >
      {children}
    </div>
  );
}

/** Legend row for the source-utilization breakdown (dot + label + amount). */
function LegendRow({ color, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-gray-500">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="font-medium tracking-tight tabular-nums text-gray-900">
        {value}
      </span>
    </div>
  );
}

/* Card 1 — Source of Funds: allocated pool + utilization breakdown,
   mirroring SourceFundsOverview's stat strip and progress legend. */
function SourceCard() {
  return (
    <PreviewCard width={320}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <Label>Source of Funds</Label>
          <div className="mt-1 text-base font-medium tracking-tight text-gray-900">
            Employee Budget
          </div>
        </div>
        <Pill>
          <Check size={10} strokeWidth={3} /> Open
        </Pill>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-medium leading-none tracking-tight tabular-nums text-gray-900">
          {formatMoney(38000)}
        </span>
        <span className="text-xs text-gray-400">allocated</span>
      </div>
      <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <span className="h-full" style={{ width: "58%", background: TEAL }} />
        <span
          className="h-full"
          style={{ width: "25%", background: "#d97706" }}
        />
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <LegendRow color={TEAL} label="Issued to Staff" value={formatMoney(22000)} />
        <LegendRow
          color="#d97706"
          label="Direct Expenses"
          value={formatMoney(9500)}
        />
        <LegendRow
          color="#E5E7EB"
          label="Available Pool"
          value={formatMoney(6500)}
        />
      </div>
      <Footer subtitle="2 sources · live ledger" />
    </PreviewCard>
  );
}

/* Card 2 — Employee budget hero: the app's signature dark hero card
   (Total Budget + ₱ watermark + Spent / Remaining counters). */
function HeroBudgetCard() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-transparent p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
      style={{
        width: 300,
        background: `linear-gradient(135deg, ${TEAL_HERO_FROM} 0%, ${TEAL_DARK} 58%, ${TEAL_DARK} 100%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22)_0%,transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-4 select-none font-display text-[96px] font-bold leading-none tracking-tighter text-white/[0.07]"
      >
        ₱
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full border border-white/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20"
      />

      <div className="relative">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/65">
          Total Budget
        </span>
        <p className="mt-2.5 font-display text-[32px] font-medium leading-none tracking-tight tabular-nums">
          {formatMoney(37850.73)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-xs">
          <div>
            <div className="text-white/60">Spent</div>
            <div className="mt-1 font-medium tabular-nums">
              {formatMoney(36660.48)}
            </div>
          </div>
          <div>
            <div className="text-white/60">Remaining</div>
            <div className="mt-1 font-medium tabular-nums">
              {formatMoney(839.52)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Card 3 — Expense ledger rows: description + category · day tag, amount and
   the ledger's Paid / Draft status dot, exactly like ExpenseSectionTable. */
function ExpensesCard() {
  const rows = [
    {
      d: "Magnolia Chicken",
      c: "Groceries",
      when: "Today",
      a: 301.5,
      status: "paid",
    },
    {
      d: "Pamasahe punta sa palengke",
      c: "Transport",
      when: "Yesterday",
      a: 150,
      status: "draft",
    },
    {
      d: "Meryenda",
      c: "Meals",
      when: "Last days",
      a: 85,
      status: "paid",
    },
  ];
  return (
    <PreviewCard width={320}>
      <div className="flex items-start justify-between mb-4">
        <Label>Expenses</Label>
        <Pill tone="neutral">
          <ReceiptText size={10} strokeWidth={2.5} /> 3 logged
        </Pill>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const s = EXPENSE_STATUS[r.status];
          return (
            <div key={r.d} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium tracking-tight text-gray-900">
                  {r.d}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {r.c} · {r.when}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums text-gray-900">
                  {formatMoney(r.a)}
                </div>
                <div
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px]"
                  style={{ color: s.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Footer subtitle="Logged against Employee Budget" />
    </PreviewCard>
  );
}

/* Card 4 — AI receipt scan: dashed dropzone result with extracted vendor,
   receipt file, item lines and total (the app's scan → expense-lines flow). */
function ReceiptCard() {
  const items = [
    { d: "Magnolia Chicken ×1", a: 301.5 },
    { d: "Eggs (tray) ×1", a: 89 },
  ];
  return (
    <PreviewCard width={300}>
      <div className="flex items-start justify-between mb-3">
        <Label>Receipt Scan</Label>
        <Pill>
          <ScanLine size={10} strokeWidth={2.5} /> AI parsed
        </Pill>
      </div>
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: TEAL_SOFT, color: TEAL_DARK }}
          >
            <ScanLine size={15} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium tracking-tight text-gray-900">
              Puregold Supermarket
            </div>
            <div className="text-[11px] text-gray-400">
              receipt-01.jpg · Oct 18
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-gray-200/70 pt-2.5">
          {items.map((it) => (
            <div
              key={it.d}
              className="flex items-center justify-between text-xs"
            >
              <span className="truncate text-gray-500">{it.d}</span>
              <span className="ml-2 font-medium tabular-nums text-gray-900">
                {formatMoney(it.a)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">
          Total
        </span>
        <span
          className="text-base font-medium tabular-nums"
          style={{ color: TEAL_DARK }}
        >
          {formatMoney(390.5)}
        </span>
      </div>
      <Footer subtitle="Image → expense lines" />
    </PreviewCard>
  );
}

/* Card 5 — Abono: outstanding cash advance with the one-tap settle action,
   plus a settled row reading as a reimbursement. */
function AbonoCard() {
  return (
    <PreviewCard width={300}>
      <div className="flex items-start justify-between mb-4">
        <Label>Abono</Label>
        <Pill tone="amber">
          <Clock size={10} strokeWidth={2.5} /> 1 open
        </Pill>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-medium leading-none tracking-tight tabular-nums text-gray-900">
          {formatMoney(1100)}
        </span>
        <span className="text-xs text-gray-400">outstanding</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium tracking-tight text-gray-900">
              Cash advance
            </div>
            <div className="mt-0.5 text-xs text-gray-400">Open · Oct 17</div>
          </div>
          <span className="text-sm font-medium tabular-nums text-gray-900">
            {formatMoney(1100)}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
            style={{ background: TEAL_SOFT, color: TEAL_DARK }}
          >
            <Check size={10} strokeWidth={3} /> Settle
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium tracking-tight text-gray-500">
              Team snacks
            </div>
            <div className="mt-0.5 text-xs text-gray-400">Settled · Oct 12</div>
          </div>
          <span className="text-sm font-medium tabular-nums text-gray-400">
            {formatMoney(825)}
          </span>
        </div>
      </div>
      <Footer subtitle="Add · settle · track" />
    </PreviewCard>
  );
}

/* Card 6 — Liquidations: money out over the last 7 days, mirroring the
   reports stat-strip sparkline and the "Total Liquidated" vocabulary. */
function LiquidationCard() {
  const bars = [32, 46, 24, 54, 100, 21, 34];
  return (
    <PreviewCard width={300}>
      <div className="flex items-start justify-between mb-4">
        <Label>Liquidations</Label>
        <Pill tone="neutral">
          <TrendingUp size={10} strokeWidth={2.5} /> 7 days
        </Pill>
      </div>
      <span className="font-display text-3xl font-medium leading-none tracking-tight tabular-nums text-gray-900">
        {formatMoney(31100)}
      </span>
      <div className="mt-1.5 text-xs text-gray-400">
        Money out · spent + employee expenses
      </div>
      <div className="mt-4 flex items-end gap-1.5 h-14">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg,${TEAL},${TEAL_DARK})`,
              opacity: 0.45 + (i / (bars.length - 1)) * 0.55,
            }}
          />
        ))}
      </div>
      <Footer subtitle="Direct + Field liquidations" />
    </PreviewCard>
  );
}
