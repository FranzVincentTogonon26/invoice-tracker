import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CircleCheck,
  EllipsisVertical,
  Eye,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ExpenseRowActions({
  row,
  pending,
  onView,
  onDelete,
  canDelete = true,
  // Admin-only draft lifecycle (mirrors the admin expenses ledger): parked
  // through onAddToDraft / restored through onRestoreFromDraft.
  canManageDraft = false,
  onAddToDraft,
  onRestoreFromDraft,
}) {
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

  const items = [
    {
      key: "view",
      label: "View expense",
      Icon: Eye,
      danger: false,
      onSelect: () => onView?.(row),
    },
    // Admin-only, one at a time based on status: a paid expense can be parked
    // in draft ("Add to draft"), a draft can be put back to paid ("Restore
    // from draft"). Expense rows only — issuance/abono ledger entries carry
    // no draft lifecycle.
    ...(canManageDraft && row?.kind === "expense" && row?.status === "paid"
      ? [
          {
            key: "draft",
            label: "Add to draft",
            Icon: RotateCcw,
            danger: false,
            onSelect: () => onAddToDraft?.(row),
          },
        ]
      : []),
    ...(canManageDraft && row?.kind === "expense" && row?.status === "draft"
      ? [
          {
            key: "restore",
            label: "Restore from draft",
            Icon: CircleCheck,
            danger: false,
            onSelect: () => onRestoreFromDraft?.(row),
          },
        ]
      : []),
    // Read-only mode (Admin → Employee Details) keeps the menu for viewing
    // but drops the destructive entry.
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "Delete expense",
            Icon: Trash2,
            danger: true,
            onSelect: () => onDelete?.(row),
          },
        ]
      : []),
  ];

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_H = 80;
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${row?.description || "expense"}`}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
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
            className="fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {items.map(({ key, label, Icon, danger, onSelect }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40",
                  danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
                )}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default ExpenseRowActions;
