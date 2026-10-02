import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  EllipsisVertical,
  Eye,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "../../../ui/Button";
import { cn } from "../../../../lib/utils";

// Shared entrance/exit easing — the same curve the other admin dialogs use.
const DIALOG_EASE = [0.16, 1, 0.3, 1];

/**
 * Destructive-confirmation dialog for the "remove employee" action — mirrors
 * the alertdialog shell used by the Budget transaction actions.
 */
function DeleteDialog({ titleId, descriptionId, pending, onClose, onConfirm }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: DIALOG_EASE }}
    >
      {/* Backdrop click = dismiss (a no-op while the request is in flight). */}
      <div
        className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending || undefined}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: DIALOG_EASE }}
        className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
          <Trash2 size={20} aria-hidden />
        </div>
        <h2
          id={titleId}
          className="mt-4 font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
        >
          Remove this employee?
        </h2>
        <p
          id={descriptionId}
          className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]"
        >
          This permanently deletes the account and its issued budget references
          from the database. This can&apos;t be undone.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Keep
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending && (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            )}
            {pending ? "Removing…" : "Yes, remove"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Menu clusters, rendered top to bottom with a separator between non-empty
// clusters: viewing, account-status moves, then the destructive action.
const MENU_GROUPS = ["view", "status", "danger"];

/**
 * Row-level actions for the Employees table, collapsed into one dropdown to
 * keep the Actions column narrow. The trigger follows the account
 * status (all reversible except delete):
 *   - view      → "View employee" (read-only profile modal)
 *   - pending   → "Approve"    (pending -> active)
 *   - active    → "Deactivate" (active -> inactive)
 *   - inactive  → "Activate"   (inactive -> active)
 *   - delete    → offered ONLY when the employee has no
 *                 `budget_issued_reference` row (no issuance history) — a
 *                 delete trigger that opens a destructive-confirmation
 *                 dialog; confirming calls `onAction("delete", employee)`.
 */
export function EmployeeActions({ employee, pending = false, onAction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

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
  }, [menuOpen]);

  const closeDelete = () => {
    // Keep the dialog open while the request is in flight — it's the only
    // signal that something is happening.
    if (removing) return;
    setConfirmDelete(false);
    triggerRef.current?.focus();
  };

  const confirmRemove = async () => {
    setRemoving(true);
    await onAction("delete", employee);
    setRemoving(false);
    setConfirmDelete(false);
  };

  const statusItem =
    employee.status === "pending"
      ? {
          key: "approve",
          label: "Approve",
          Icon: BadgeCheck,
          action: "approve",
        }
      : employee.status === "active"
        ? {
            key: "deactivate",
            label: "Deactivate",
            Icon: UserX,
            action: "deactivate",
          }
        : employee.status === "inactive"
          ? {
              key: "activate",
              label: "Activate",
              Icon: UserCheck,
              action: "activate",
            }
          : null;

  const items = [
    {
      key: "view",
      label: "View employee",
      Icon: Eye,
      danger: false,
      group: "view",
      run: () => onAction("view", employee),
    },
    ...(statusItem
      ? [
          {
            ...statusItem,
            danger: false,
            group: "status",
            run: () => onAction(statusItem.action, employee),
          },
        ]
      : []),
    // Delete is offered ONLY when the employee was never issued budget — any
    // `budget_issued_reference` row means history that must survive (the
    // server rejects the delete too). Falls back to the transaction count for
    // payloads that predate `issued_reference_count`.
    ...(
      Number(
        employee.issued_reference_count ?? employee.issued_references,
      ) || 0
    ) > 0
      ? []
      : [
          {
            key: "delete",
            label: "Delete employee",
            Icon: Trash2,
            danger: true,
            group: "danger",
            run: () => setConfirmDelete(true),
          },
        ],
  ];

  // Preserve group order, dropping empty clusters so no stray separator
  // renders.
  const sections = MENU_GROUPS.map((group) =>
    items.filter((item) => item.group === group),
  ).filter((section) => section.length > 0);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_H = 220;
      const roomBelow = window.innerHeight - rect.bottom;
      const flipUp = roomBelow < MENU_H + 8 && rect.top > MENU_H + 8;

      setPosition({
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(true);
  };

  const runItem = (run) => {
    setMenuOpen(false);
    run();
  };

  return (
    <>
      <div className="flex items-center justify-end">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${employee.name || "employee"}`}
          disabled={pending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
        >
          <EllipsisVertical size={16} aria-hidden />
        </button>
      </div>

      {menuOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Employee actions"
            style={{ ...position }}
            className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover"
          >
            {sections.map((section, sectionIndex) => (
              <div key={section[0].group}>
                {sectionIndex > 0 && (
                  <div
                    role="separator"
                    aria-hidden
                    className="mx-3 border-t border-[var(--border)]"
                  />
                )}
                {section.map(({ key, label, Icon, danger, run }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={() => runItem(run)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-40",
                      danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
                    )}
                  >
                    <Icon size={15} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {createPortal(
        <AnimatePresence>
          {confirmDelete && (
            <DeleteDialog
              key="delete-confirm"
              titleId={titleId}
              descriptionId={descriptionId}
              pending={removing}
              onClose={closeDelete}
              onConfirm={confirmRemove}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export default EmployeeActions;
