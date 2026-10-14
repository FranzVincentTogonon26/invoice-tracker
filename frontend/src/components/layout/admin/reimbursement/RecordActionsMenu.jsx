import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EllipsisVertical, Eye, LockOpen } from "lucide-react";

// Kebab menu for one finalized issuance record: reopen (confirm lives with
// the caller) and preview. Owns its open state plus outside-tap / Escape
// dismissal, so hosts stay free of menu plumbing.
export function RecordActionsMenu({ canReopen, onReopen, onPreview }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        size="iconSm"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Record actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Record actions"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] ring-1 ring-inset ring-[var(--border)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <EllipsisVertical size={14} aria-hidden />
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            aria-label="Record actions"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+8px)] z-[99999] w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-hover"
          >
            {canReopen && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onReopen?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <LockOpen size={14} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Reopen reimbursement</span>
                  <span className="block truncate text-xs font-normal text-[var(--ink-muted)]">
                    Return the record to open
                  </span>
                </span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onPreview?.();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)]">
                <Eye size={14} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate">Preview reimbursement</span>
                <span className="block truncate text-xs font-normal text-[var(--ink-muted)]">
                  Summary of this record
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RecordActionsMenu;
