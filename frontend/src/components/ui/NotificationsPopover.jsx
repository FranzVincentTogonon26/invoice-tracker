import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ArrowLeftRight,
  HandCoins,
  Plus,
  ReceiptText,
  Wallet,
  Layers,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useTransactions } from "@/hooks/useTransactions";
import { cn, relativeTime, formatMoney } from "@/lib/utils";

// Mirrors the unified ledger kinds (see TransactionsTable) — every entry
// links to a real row on /admin/transaction, never a dead route.
const KIND_META = {
  budget: { label: "Budget Given", Icon: Plus, tone: "bg-[var(--surface-2)] text-[var(--ink-muted)]" },
  issued: { label: "Budget Issued", Icon: HandCoins, tone: "bg-[var(--accent-soft)] text-[var(--accent-strong)]" },
  expense: { label: "Expense", Icon: ReceiptText, tone: "bg-[var(--warning)]/12 text-[var(--warning)]" },
  abono: { label: "Abono", Icon: Wallet, tone: "bg-[var(--success)]/12 text-[var(--success)]" },
  transfer_sent: { label: "Transfer Sent", Icon: ArrowLeftRight, tone: "bg-[var(--danger)]/12 text-[var(--danger)]" },
  transfer_received: { label: "Transfer Received", Icon: ArrowLeftRight, tone: "bg-[var(--success)]/12 text-[var(--success)]" },
};

const FALLBACK_META = { label: "Activity", Icon: Layers, tone: "bg-[var(--surface-2)] text-[var(--ink-muted)]" };

export function NotificationsPopover() {
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  const recent = (transactions || []).slice(0, 7);
  const attention = (transactions || []).filter((t) => t.flagged).length;

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        dot={attention > 0}
        aria-label={`Notifications${attention > 0 ? ` (${attention} flagged)` : ""}`}
      >
        <Bell size={16} />
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[52px] z-40 w-[380px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover overflow-hidden"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--ink)]">
                Recent activity
              </div>
              {attention > 0 && (
                <span className="text-xs font-medium text-[var(--danger)] tabular-nums">
                  {attention} flagged
                </span>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {recent.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="h-10 w-10 mx-auto rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-muted)] mb-3">
                    <Bell size={16} />
                  </div>
                  <div className="text-sm font-medium text-[var(--ink)]">
                    Nothing here yet
                  </div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    New budgets, issuances and expenses will show up here.
                  </div>
                </div>
              ) : (
                <ul>
                  {recent.map((tx, idx) => {
                    const meta = KIND_META[tx.kind] ?? FALLBACK_META;
                    const Icon = meta.Icon;
                    return (
                      <li key={tx.key ?? tx.id ?? idx}>
                        <button
                          onClick={() => {
                            navigate("/admin/transaction");
                            setOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-[var(--surface-2)] transition-colors",
                            idx > 0 && "border-t border-[var(--border)]",
                          )}
                        >
                          <div
                            className={cn(
                              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                              meta.tone,
                            )}
                          >
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--ink)] truncate">
                              {tx.description || meta.label}
                            </div>
                            <div className="text-xs text-[var(--ink-muted)] mt-0.5 truncate capitalize">
                              {meta.label} · {formatMoney(tx.amount)}
                            </div>
                          </div>
                          <div className="text-xs text-[var(--ink-muted)] shrink-0 tabular-nums mt-0.5">
                            {relativeTime(tx.date)}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              onClick={() => {
                navigate("/admin/transaction");
                setOpen(false);
              }}
              className="w-full h-11 border-t border-[var(--border)] text-xs font-medium text-[var(--accent-strong)] hover:bg-[var(--surface-2)] transition-colors"
            >
              View all activity
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
