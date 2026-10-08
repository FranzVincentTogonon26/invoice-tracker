import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, Eye, HandCoins } from "lucide-react";

// Row-actions dropdown for the reimbursement personnel ledger — "View
// employee" opens the admin employee profile, "Reimbursement" opens the same
// profile straight on its Abono tab. Floating portal menu with the same
// dismiss behavior as the other ledger row menus.
export function PersonnelActions({ onViewEmployee, onViewReimbursement }) {
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
    window.addEventListener("scroll", close, {
      capture: true,
      passive: true,
    });
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
    "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <EllipsisVertical size={16} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Row actions"
            style={{ ...position }}
            className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onViewEmployee?.();
              }}
              className={itemClass}
            >
              <Eye size={15} aria-hidden />
              View employee
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onViewReimbursement?.();
              }}
              className={itemClass}
            >
              <HandCoins size={15} aria-hidden />
              Reimbursement
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

export default PersonnelActions;
