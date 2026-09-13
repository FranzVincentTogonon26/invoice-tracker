import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  EllipsisVertical,
  Eye,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { USER_ROLES } from "../../../../constants";

// Actions that make sense per transaction status â€” the menu only ever shows
// actions that are valid for the row's current status (and the viewer's role).
const ACTIONS_BY_STATUS = {
  draft: ["view", "edit", "approve", "reject", "delete"],
  pending: ["view", "approve", "reject", "cancel"],
  added: ["view", "cancel"],
  approved: ["view", "cancel"],
  cancelled: ["view", "delete"],
  rejected: ["view"],
};

const ACTION_META = {
  view: { label: "View details", icon: Eye },
  edit: { label: "Edit", icon: Pencil },
  approve: { label: "Approve", icon: CheckCircle2 },
  reject: { label: "Reject", icon: XCircle },
  cancel: { label: "Cancel", icon: Ban },
  delete: { label: "Delete", icon: Trash2, danger: true },
};

// Employees can only inspect a transaction; admins get the full set.
export const getAvailableActions = (status, role = USER_ROLES.ADMIN) =>
  (ACTIONS_BY_STATUS[status] ?? ["view"]).filter(
    (key) => role === USER_ROLES.ADMIN || key === "view",
  );

/**
 * Row-level three-dot action menu. Keyboard accessible: trigger opens with
 * Enter/Space/ArrowDown/ArrowUp, ArrowUp/Down/Home/End move between items,
 * Escape closes and returns focus to the trigger.
 * Clicking an item calls `onAction(actionKey, transaction)`.
 */
export function TransactionActions({
  transaction,
  role,
  onAction,
  openUp = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  const actions = getAvailableActions(transaction.status, role);

  // Close on any pointer press outside the menu while open.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const menuItems = () =>
    rootRef.current?.querySelectorAll("[role='menuitem']") ?? [];

  const focusItemAt = (index) => {
    const items = menuItems();
    if (!items.length) return;
    // Modulo wraps both ways: -1 lands on the last item.
    items[((index % items.length) + items.length) % items.length]?.focus();
  };

  const openMenu = (focus = "first") => {
    setOpen(true);
    // Wait for the menu to mount before moving focus into it.
    requestAnimationFrame(() => focusItemAt(focus === "first" ? 0 : -1));
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openMenu("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu("last");
    }
  };

  const handleMenuKeyDown = (e) => {
    const currentIndex = Array.from(menuItems()).indexOf(
      document.activeElement,
    );
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItemAt(currentIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItemAt(currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItemAt(0);
        break;
      case "End":
        e.preventDefault();
        focusItemAt(-1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${transaction.description || "transaction"}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <EllipsisVertical size={16} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Transaction actions"
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-40 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover",
              openUp ? "bottom-full right-0 mb-1.5" : "right-0 top-full mt-1.5",
            )}
          >
            {actions.map((key) => {
              const meta = ACTION_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onAction?.(key, transaction);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none",
                    meta.danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
                  )}
                >
                  <Icon size={15} aria-hidden className="shrink-0 opacity-70" />
                  {meta.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
