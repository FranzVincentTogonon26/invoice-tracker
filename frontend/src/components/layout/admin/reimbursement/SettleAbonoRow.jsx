import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// One open-abono checkbox row inside the settlement dialog.
export function SettleAbonoRow({ row: r, index = 0, checked, disabled, onToggle }) {
  return (
    <motion.li
      key={r.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: DIALOG_EASE,
        delay: Math.min(index * 0.04, 0.24),
      }}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
    >
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`Settle "${r.description || "abono"}"`}
        disabled={disabled}
        onClick={() => onToggle(r.id)}
        whileTap={{ scale: 0.82 }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 22,
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
          checked
            ? "border-transparent bg-[var(--accent-strong)] text-white"
            : "border-[var(--border)] text-transparent hover:border-[var(--accent)]/50"
        }`}
      >
        <Check size={14} strokeWidth={3} aria-hidden />
      </motion.button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--ink)]">
          {r.description || "Abono"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {r.reference_label || "No source"} · {formatDate(r.created_at)}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(r.amount)}
      </span>
    </motion.li>
  );
}

export default SettleAbonoRow;
