import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Plus, Sparkles, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Input, TextArea } from "../../../ui/Input";
import { formatDate } from "@/lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];
const LABEL_MAX = 120;
const NOTES_MAX = 500;

export function SourceCreateModal({ open, saving, onClose, onSave }) {
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const today = new Date();
  const trimmed = label.trim();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErr("");
    if (!trimmed) {
      setErr("Give the source a label.");
      return;
    }
    await onSave({ label: trimmed, notes: notes.trim() });
  };

  const handleClose = () => {
    if (saving) return;
    setErr("");
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="source-create-title"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            {/* Hero */}
            <div className="relative overflow-hidden bg-[linear-gradient(135deg,var(--accent-soft)_0%,transparent_75%)] px-6 pb-5 pt-6 sm:px-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-[var(--accent)]/20"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-[var(--accent)]/10"
              />
              <div className="relative flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-white shadow-card">
                  <Plus size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    id="source-create-title"
                    className="font-display text-lg font-medium tracking-tight text-[var(--ink)]"
                  >
                    New source of funds
                  </h3>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--ink-muted)]">
                    Budgets allocate from it, issue to employees, and spend
                    against it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)]/80 px-3 py-1 text-xs tabular-nums text-[var(--ink-muted)] shadow-card backdrop-blur">
                <CalendarDays size={13} aria-hidden />
                Creation date{" "}
                <span className="font-medium text-[var(--ink)]">
                  {formatDate(today)}
                </span>
              </p>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-5 sm:px-7">
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="type-eyebrow text-[var(--ink-muted)]">
                    Label
                  </span>
                  <span className="text-xs tabular-nums text-[var(--ink-muted)] opacity-70">
                    {label.length}/{LABEL_MAX}
                  </span>
                </span>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Q1 Operations"
                  disabled={saving}
                  maxLength={LABEL_MAX}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="type-eyebrow text-[var(--ink-muted)]">
                    Notes{" "}
                    <span className="ml-1 normal-case tracking-normal opacity-70">
                      · optional
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-[var(--ink-muted)] opacity-70">
                    {notes.length}/{NOTES_MAX}
                  </span>
                </span>
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What is this source for…"
                  rows={2}
                  maxLength={NOTES_MAX}
                  disabled={saving}
                />
              </label>

              {/* Live preview */}
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--accent)]/35 bg-[var(--accent-soft)]/30 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Sparkles size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {trimmed || "Your source label"}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {notes.trim() || "Opens ready to fund budgets"}
                  </p>
                </div>
              </div>

              {err && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[var(--danger)]"
                >
                  {err}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={saving || !trimmed}
                title={!trimmed ? "Give the source a label first" : undefined}
                className="w-full sm:w-auto"
              >
                <Plus size={14} /> Create source
              </Button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SourceCreateModal;
