import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  isFlagged,
  overviewConfigFor,
  overviewTitle,
} from "@/lib/overviewLedger";
import { OverviewDetailsBody } from "./OverviewDetailsBody";

// Desktop detail dialog (createPortal) — centered modal for wide screens.
// Reuses OverviewDetailsBody, so the content always depends on the row's
// type + status exactly like the mobile sheet does.
export function OverviewDialog({ row, onClose }) {
  const dialogRef = useRef(null);
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

  useEffect(() => {
    if (row) dialogRef.current?.focus();
  }, [row]);

  const meta = overviewConfigFor(row?.kind);
  const Icon = meta.Icon;
  const title = overviewTitle(row, meta);

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="overview-dialog"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
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
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
            className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto scrollbar-slim rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover outline-none sm:p-6"
          >
            <div className="flex items-center gap-3">
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
                aria-label="Close transaction details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <OverviewDetailsBody row={row} meta={meta} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default OverviewDialog;
