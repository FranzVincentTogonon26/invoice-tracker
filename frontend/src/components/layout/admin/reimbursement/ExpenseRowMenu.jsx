import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  EllipsisVertical,
  Eye,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Per-row actions menu ─────────────────────────────────────────────────────
//
// Kebab dropdown: View opens the expense details modal (receipt tab included
// when the row carries one); Cancel voids the row (status → 'cancel');
// cancelled rows offer Restore (→ 'paid') instead so the void is undoable.
// `viewOnly` (closed accounts) strips everything but View.
export function ExpenseRowMenu({
  status,
  busy,
  viewOnly,
  onView,
  onCancel,
  onRestore,
}) {
  const cancelled = status === "cancel";
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      setOpen(false);
      btnRef.current?.focus();
    };
    const handlePointerDown = (e) => {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      )
        close();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_H = 120;
      const roomBelow = window.innerHeight - rect.bottom;
      const flipUp = roomBelow < MENU_H + 8 && rect.top > MENU_H + 8;
      setPosition({
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  };

  const itemClass =
    "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Expense actions"
        disabled={busy}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <EllipsisVertical size={15} aria-hidden />
        )}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Expense actions"
            style={{ ...position }}
            className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onView?.();
              }}
              className={cn(itemClass, "text-[var(--ink)]")}
            >
              <Eye size={15} aria-hidden />
              View
            </button>
            {!viewOnly &&
              (cancelled ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onRestore?.();
                  }}
                  className={cn(itemClass, "text-[var(--ink)]")}
                >
                  <RefreshCcw size={15} aria-hidden />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onCancel?.();
                  }}
                  className={cn(itemClass, "text-[var(--danger)]")}
                >
                  <Ban size={15} aria-hidden />
                  Cancel
                </button>
              ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default ExpenseRowMenu;
