import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Modern balance stat tile ─────────────────────────────────────────────────
//
// Elevated, card-style tile: soft background, tinted icon square, uppercase
// eyebrow label, large display value and a per-tile hint. Each tile gets a
// semantic colour from its `tone`.
//
// `tone` vocabulary: neutral | accent | success | warning | danger

const toneMeta = {
  neutral: {
    tile: "bg-[var(--surface-2)]",
    icon: "bg-[var(--surface-2)] text-[var(--ink)]",
    value: "text-[var(--ink)]",
  },
  accent: {
    tile: "bg-[var(--accent-soft)]",
    icon: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    value: "text-[var(--accent-strong)]",
  },
  success: {
    tile: "bg-[var(--success)]/12",
    icon: "bg-[var(--success)]/12 text-[var(--success)]",
    value: "text-[var(--success)]",
  },
  warning: {
    tile: "bg-[var(--warning)]/12",
    icon: "bg-[var(--warning)]/12 text-[var(--warning)]",
    value: "text-[var(--warning)]",
  },
  danger: {
    tile: "bg-[var(--danger)]/12",
    icon: "bg-[var(--danger)]/12 text-[var(--danger)]",
    value: "text-[var(--danger)]",
  },
};

export function BalanceStat({ icon: Icon, label, value, hint, tone = "neutral" }) {
  const m = toneMeta[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-card transition-shadow hover:shadow-hover sm:p-3.5",
        m.tile,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          m.icon,
        )}
      >
        <Icon size={16} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="type-eyebrow truncate text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate font-display text-lg font-medium tabular-nums tracking-tight sm:text-xl",
            m.value,
          )}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 hidden truncate text-[11px] tabular-nums text-[var(--ink-muted)] sm:block">
            {hint}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default BalanceStat;
