import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "../../../ui/Button";

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
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Keep
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={pending}>
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

/**
 * Row-level actions for the Employees table. The trigger follows the account
 * status (all reversible except delete):
 *   - pending   → "Approve"    (pending -> active)
 *   - active    → "Deactivate" (active -> inactive)
 *   - inactive  → "Activate"   (inactive -> active)
 *   - always    → a delete trigger that opens a destructive-confirmation
 *                 dialog; confirming calls `onAction("delete", employee)`.
 */
export function EmployeeActions({ employee, pending = false, onAction }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const triggerRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

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

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {employee.status === "pending" && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => onAction("approve", employee)}
            disabled={pending}
          >
            Approve
          </Button>
        )}
        {employee.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("deactivate", employee)}
            disabled={pending}
          >
            Deactivate
          </Button>
        )}
        {employee.status === "inactive" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("activate", employee)}
            disabled={pending}
          >
            Activate
          </Button>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          title="Remove employee"
          aria-label={`Remove ${employee.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>

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