import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionButton({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        danger
          ? "text-[var(--ink-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
          : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

export function RowMenu({ source, onView, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => {
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    const handlePointerDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
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
  }, [menuOpen]);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    setMenuOpen(true);
  };

  const items = [
    {
      label: "View details",
      Icon: Eye,
      danger: false,
      run: () => onView(source),
    },
    {
      label: "Edit source",
      Icon: Pencil,
      danger: false,
      run: () => onEdit(source),
    },
    {
      label: "Delete source",
      Icon: Trash2,
      danger: true,
      run: () => onDelete(source),
    },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Source actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <EllipsisVertical size={16} aria-hidden />
      </button>
      {menuOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Source actions"
            style={{ top: position.top, right: position.right }}
            className="fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {items.map(({ label, Icon, danger, run }, i) => (
              <div key={label}>
                {i === items.length - 1 && (
                  <div
                    role="separator"
                    aria-hidden
                    className="my-1 border-t border-[var(--border)]"
                  />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    run();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]",
                    danger
                      ? "text-[var(--danger)] hover:bg-[var(--danger)]/10"
                      : "text-[var(--ink)]",
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
