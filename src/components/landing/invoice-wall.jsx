import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BellRing,
  Check,
  CheckCircle2,
  Receipt,
  ScanLine,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";

export default function InvoiceWall() {
  const colA = [
    <InvoiceCard key="a1" />,
    <RevenueCard key="a2" />,
    <PaymentCard key="a3" />,
  ];
  const colB = [
    <ReceiptCard key="b1" />,
    <ReminderCard key="b2" />,
    <PaidCard key="b3" />,
  ];
  const colC = [
    <ClientCard key="c1" />,
    <StatCard2 key="c2" />,
    <ExpenseCard key="c3" />,
  ];

  return (
    <div
      className="relative h-[600px] overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      <div className="absolute inset-0 flex justify-center gap-4">
        <ScrollColumn cards={colA} direction="up" duration={30} />
        <ScrollColumn cards={colB} direction="down" duration={36} />
        <ScrollColumn
          cards={colC}
          direction="up"
          duration={44}
          className="hidden xl:block"
        />
      </div>
    </div>
  );
}

function WallCard({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-[22px] bg-white border border-black/[0.04] shadow-[0_24px_50px_-28px_rgba(13,42,37,0.45)] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
const Label = ({ children }) => (
  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
    {children}
  </div>
);

function Pill({ children, tone = "teal" }) {
  const s =
    tone === "teal"
      ? { background: "#d3f4ec", color: TEAL_DARK }
      : tone === "rose"
        ? { background: "#fde7ea", color: "#be123c" }
        : { background: "#fbf1e2", color: "#b45309" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={s}
    >
      {children}
    </span>
  );
}

const CardFoot = ({ children }) => (
  <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center gap-2">
    <span
      className="h-4 w-4 rounded-[5px]"
      style={{ background: `linear-gradient(135deg,${TEAL},${TEAL_DARK})` }}
    />
    <span className="text-[11px] font-medium text-gray-600">{children}</span>
  </div>
);

function ScrollColumn({ cards, direction, duration, className }) {
  const doubled = [...cards, ...cards];
  const from = direction === "up" ? "0%" : "-50%";
  const to = direction === "up" ? "-50%" : "0%";
  return (
    <div className={cn("w-[228px] shrink-0", className)}>
      <motion.div
        className="flex flex-col gap-3.5"
        animate={{ y: [from, to] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
      </motion.div>
    </div>
  );
}

function InvoiceCard() {
  return (
    <WallCard>
      <div className="flex items-start justify-between mb-3">
        <div>
          <Label>Invoice</Label>
          <div className="text-[15px] font-bold text-gray-900 mt-1 tabular-nums">
            INV-0042
          </div>
        </div>
        <Pill>Sent</Pill>
      </div>
      {[
        ["Design sprint", "$3,200"],
        ["Development · 24h", "$2,280"],
      ].map(([d, a]) => (
        <div
          key={d}
          className="flex items-center justify-between text-[12px] py-0.5"
        >
          <span className="text-gray-500">{d}</span>
          <span className="text-gray-900 font-semibold tabular-nums">{a}</span>
        </div>
      ))}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          Total
        </span>
        <span
          className="text-[17px] font-bold tabular-nums"
          style={{ color: TEAL_DARK }}
        >
          $5,480
        </span>
      </div>
      <CardFoot>Nova Retail Group</CardFoot>
    </WallCard>
  );
}

function RevenueCard() {
  return (
    <WallCard>
      <div className="flex items-start justify-between mb-3">
        <div>
          <Label>Total Revenue</Label>
          <div className="text-[26px] font-bold text-gray-900 mt-1 tabular-nums">
            $311K
          </div>
        </div>
        <Pill>
          <TrendingUp size={10} strokeWidth={2.5} /> +12%
        </Pill>
      </div>
      <div className="flex items-end gap-1.5 h-12">
        {[42, 58, 50, 72, 63, 88].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg,#2dd4bf,${TEAL_DARK})`,
              opacity: 0.45 + i * 0.09,
            }}
          />
        ))}
      </div>
      <CardFoot>Last 6 months</CardFoot>
    </WallCard>
  );
}

function ReceiptCard() {
  return (
    <WallCard>
      <div className="flex items-start justify-between mb-2.5">
        <Label>AI Receipt Scan</Label>
        <Pill>
          <ScanLine size={10} strokeWidth={2.5} /> Parsed
        </Pill>
      </div>
      <div className="rounded-xl p-3" style={{ background: "#d3f4ec" }}>
        <div
          className="text-[9px] uppercase tracking-wide font-semibold mb-1"
          style={{ color: TEAL_DARK }}
        >
          Extracted
        </div>
        <div className="text-[13px] font-semibold text-gray-900">
          Adobe Inc.
        </div>
        <div className="flex items-center justify-between text-[12px] text-gray-600 mt-1">
          <span>Creative Cloud ×1</span>
          <span className="tabular-nums font-bold text-gray-900">$54.99</span>
        </div>
      </div>
      <CardFoot>Image → invoice</CardFoot>
    </WallCard>
  );
}

function PaymentCard() {
  return (
    <WallCard>
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: "#dcfce7" }}
        >
          <CheckCircle2 size={17} className="text-emerald-600" />
        </div>
        <div>
          <Label>Payment received</Label>
          <div className="text-[17px] font-bold text-gray-900 tabular-nums">
            $7,595.00
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-3">
        <span>INV-0038 · Harbor & Co.</span>
        <span>Bank transfer</span>
      </div>
    </WallCard>
  );
}

function ReminderCard() {
  return (
    <WallCard>
      <div className="flex items-start justify-between mb-2.5">
        <Label>AI Reminder</Label>
        <Pill>
          <Sparkles size={10} strokeWidth={2.5} /> Drafted
        </Pill>
      </div>
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <BellRing size={12} style={{ color: TEAL_DARK }} />
          <span className="text-[12px] font-semibold text-gray-900">
            Friendly nudge
          </span>
        </div>
        <p className="text-[11.5px] text-gray-500 leading-snug">
          "Hi Nova — a gentle reminder that INV-0021 for $2,400 was due last
          week…"
        </p>
      </div>
      <CardFoot>One click to send</CardFoot>
    </WallCard>
  );
}

function PaidCard() {
  return (
    <WallCard>
      <div className="flex items-start justify-between mb-3">
        <Label>Paid this month</Label>
        <Pill>
          <Check size={10} strokeWidth={3} /> On track
        </Pill>
      </div>
      <div className="text-[28px] font-bold text-gray-900 tabular-nums">
        $42,180
      </div>
      <div className="flex items-center gap-1 mt-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{ background: i < 6 ? TEAL : "#e5e7eb" }}
          />
        ))}
      </div>
      <CardFoot>6 of 8 invoices paid</CardFoot>
    </WallCard>
  );
}

function ClientCard() {
  return (
    <WallCard>
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ background: `linear-gradient(135deg,${TEAL},${TEAL_DARK})` }}
        >
          B
        </div>
        <div>
          <div className="text-[13px] font-semibold text-gray-900">
            Brightline Studios
          </div>
          <div className="text-[11px] text-gray-400">New York, NY</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">
            Billed
          </div>
          <div className="text-[13px] font-bold text-gray-900 tabular-nums">
            $18.4K
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">
            Owed
          </div>
          <div
            className="text-[13px] font-bold tabular-nums"
            style={{ color: "#b45309" }}
          >
            $3.8K
          </div>
        </div>
      </div>
    </WallCard>
  );
}

function StatCard2() {
  return (
    <WallCard>
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: "#d3f4ec" }}
        >
          <Wallet size={16} style={{ color: TEAL_DARK }} />
        </div>
        <div>
          <Label>Outstanding</Label>
          <div className="text-[17px] font-bold text-gray-900 tabular-nums">
            $23,760
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] mt-3">
        <span className="text-gray-500">12 open invoices</span>
        <Pill tone="rose">3 overdue</Pill>
      </div>
    </WallCard>
  );
}

function ExpenseCard() {
  return (
    <WallCard>
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: "#fbf1e2" }}
        >
          <Receipt size={16} style={{ color: "#b45309" }} />
        </div>
        <div>
          <Label>Expense</Label>
          <div className="text-[14px] font-bold text-gray-900">
            AWS · Hosting
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[12px] mt-3">
        <span className="text-gray-500">Jul 2026 · card ****3140</span>
        <span className="tabular-nums font-bold text-gray-900">$128.40</span>
      </div>
    </WallCard>
  );
}
