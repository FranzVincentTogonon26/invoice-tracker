import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  hasOverviewReceipt,
  isFlagged,
  overviewConfigFor,
  overviewTitle,
} from "@/lib/overviewLedger";
import { Button } from "../../../ui/Button";
import { OverviewDetailsBody } from "./OverviewDetailsBody";

/* ── Mobile bottom sheet — same slide-up as the budget sheet ── */
// Mobile-only (md:hidden): tapping a card opens this portal with the
// tapped row's details + summary. Desktop keeps the plain table.
export function OverviewSheet({ row, onClose, onView }) {
  const sheetRef = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!row) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [row, close]);

  const meta = overviewConfigFor(row?.kind);
  const Icon = meta.Icon;
  // Shared with the desktop dialog so both headers read identically.
  const title = overviewTitle(row, meta);
  // An expense carrying a receipt offers a jump into the full receipt UI.
  const hasReceipt = hasOverviewReceipt(row);

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="overview-sheet"
          className="fixed inset-0 z-[70] flex flex-col justify-end md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: PANEL_EASE }}
            className={cn(
              "scrollbar-slim relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain outline-none",
              "rounded-t-[15px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover will-change-transform",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <div
              aria-hidden
              className="mx-auto h-1.5 w-10 rounded-full bg-[var(--ink-muted)]/25"
            />
            <div className="flex items-center gap-3 pt-4">
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  isFlagged(row)
                    ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : meta.iconWrapperClass,
                )}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatDate(row?.date)}
                  {row?.date ? ` · ${formatTime(row.date)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close transaction preview"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <OverviewDetailsBody row={row} meta={meta} />
            {hasReceipt && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="accent"
                  className="w-full"
                  onClick={() => {
                    close();
                    onView?.(row);
                  }}
                >
                  <Eye size={15} aria-hidden />
                  View details & receipt
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default OverviewSheet;
