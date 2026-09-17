import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Hash,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "../../../ui/Input";
import { Button } from "../../../ui/Button";
import toast from "react-hot-toast";

import { formatDate } from "../../../../lib/utils";
import { useBudgetMutations } from "../../../../hooks/useBudget";
import useSmoothScroll from "../../../../hooks/useSmoothScroll";

// Error banners auto-dismiss after this long (ms); AnimatePresence plays the
// smooth fade/slide/height-collapse exit when the message clears.
const ERROR_VISIBLE_MS = 5000;

const ReferencesModal = ({
  open,
  references = [],
  onAdd,
  onDelete,
  onClose,
}) => {
  const { create, removeReference: remove } = useBudgetMutations();
  // Smooth eased wheel scrolling for the references table (scrub feel)
  const tableRef = useSmoothScroll();
  const [newRef, setNewRef] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Auto-dismiss: clear the error after ERROR_VISIBLE_MS so stale messages
  // don't linger. Restarted every time a new error appears; clearing triggers
  // the smooth exit animation below via AnimatePresence.
  useEffect(() => {
    if (!err) return undefined;

    const id = setTimeout(() => setErr(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [err]);

  // Reset the form each time the modal opens
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setNewRef("");
    setErr("");
    setAdding(false);
    setDeletingId(null);
  }

  const handleClose = () => {
    if (adding || deletingId) return;
    setNewRef("");
    setErr("");
    onClose();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setErr("");

    const label = newRef.trim();
    if (!label) {
      setErr("Reference name/label is required.");
      return;
    }

    setAdding(true);
    try {
      const created = await create.mutateAsync({
        type: "addBudgetReference",
        label,
      });
      await onAdd?.(created);

      setNewRef("");
      onClose();
      toast.success(`Reference "${label}" added!`);
    } catch (error) {
      setErr(error?.message || "Couldn't add reference");
    } finally {
      setAdding(false);
    }
  };

  // Deletes the reference row in the DB, drops it from the parent's local
  // list and clears the dropdown selection if it was selected.
  const handleDelete = async (referenceId) => {
    if (adding || deletingId) return;
    setErr("");
    setDeletingId(referenceId);
    try {
      await remove.mutateAsync(referenceId);
      onDelete?.(referenceId);
      toast.success("Reference removed!");
    } catch (error) {
      setErr(error?.message || "Couldn't remove reference");
    } finally {
      setDeletingId(null);
    }
  };

  // Close on Escape while open (never while adding/deleting). stopPropagation
  // keeps the parent BudgetModal's window-level Escape handler from also firing.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !adding && !deletingId) {
        e.stopPropagation();
        setNewRef("");
        setErr("");
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, adding, deletingId, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div
            onClick={handleClose}
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm flex items-center justify-center px-2"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="references-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-full max-w-[600px] flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7"
            >
              <div className="flex shrink-0 items-start justify-between mb-5">
                <div className="min-w-0">
                  <h3
                    id="references-modal-title"
                    className="font-display text-lg font-semibold tracking-tight"
                  >
                    Budget Source Reference
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
                    Manage the source references budgets are allocated from.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Add-new-reference form */}
              <form
                onSubmit={handleAdd}
                className="flex shrink-0 items-center gap-2"
              >
                <Input
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  placeholder="New reference label…"
                  Icon={Hash}
                  disabled={adding}
                  autoFocus
                />
                <Button
                  type="submit"
                  variant="soft"
                  size="icon"
                  disabled={adding}
                  aria-label="Add new reference"
                >
                  {adding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                </Button>
              </form>

              {/* References table — scrolls on its own so the header, the
                  add form and the footer stay pinned when the list is long */}
              <div
                ref={tableRef}
                className="scrollbar-slim mt-5 max-h-[50vh] min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--border)]"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[var(--surface-2)] text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                      <th className="px-4 py-2.5 text-left font-semibold">
                        Reference Id
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold">
                        Source Name
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold">
                        Date Created
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {references.map((reference) => (
                      <tr
                        key={reference.reference_id}
                        className="border-t border-[var(--border)] first:border-t-0 hover:bg-[var(--surface-2)]/60 transition-colors"
                      >
                        <td
                          title={reference.reference_id}
                          className="px-4 py-2.5 font-mono text-[13px] text-[var(--ink)] break-all"
                        >
                          {`${(reference.reference_id ?? "").slice(0, 8)}-xxxxx`}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--ink)] max-w-[160px] truncate">
                          {reference.label ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-[var(--ink-muted)] whitespace-nowrap">
                          {formatDate(
                            reference.created_at ?? reference.date_created,
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {/* `active` is a COUNT of issued budgets using this
                              reference (backend budgetReference query). In-use
                              references (active > 0) are locked — show a
                              success-themed Check instead of the delete
                              button; unused ones (active === 0) stay
                              deletable. */}
                          {Number(reference.active) > 0 ? (
                            <span
                              title={`In use by ${reference.active} issued budget${
                                Number(reference.active) === 1 ? "" : "s"
                              } — cannot be deleted`}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)] cursor-default select-none"
                            >
                              <Check size={10} strokeWidth={2.5} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(reference.reference_id)
                              }
                              disabled={adding || deletingId !== null}
                              aria-label={`Delete reference ${
                                reference.label || reference.reference_id
                              }`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-40"
                            >
                              {deletingId === reference.reference_id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {references.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]"
                        >
                          No references yet — add one above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <AnimatePresence initial={false}>
                {err && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      height: "auto",
                      marginTop: 16,
                    }}
                    exit={{
                      opacity: 0,
                      y: -4,
                      height: 0,
                      marginTop: 0,
                      transition: { duration: 0.25, ease: "easeOut" },
                    }}
                    role="alert"
                    className="flex items-start gap-2 overflow-hidden text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-4"
                  >
                    <AlertCircle size={14} className="mt-px shrink-0" />
                    {err}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex shrink-0 items-center justify-end gap-2 mt-5 pt-5 border-t border-[var(--border)]">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReferencesModal;
