import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Calendar1Icon, Loader2, Plus, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { DatePicker } from "../../../ui/DatePicker";
import { Input, TextArea } from "../../../ui/Input";

const LABEL_MAX = 120;
const NOTES_MAX = 500;

function ContextCard({ icon, title, subtitle, badge, badgeTone = "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3 shadow-card">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {badge && <Badge tone={badgeTone}>{badge}</Badge>}
    </div>
  );
}

function Field({ label, optional, children, count, max }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="type-eyebrow text-[var(--ink-muted)]">
          {label}
          {optional && (
            <span className="ml-1.5 normal-case tracking-normal text-xs opacity-70">
              · optional
            </span>
          )}
        </span>
        {max != null && (
          <span
            className={`text-xs tabular-nums ${
              (count ?? 0) >= max
                ? "text-[var(--warning)]"
                : "text-[var(--ink-muted)] opacity-70"
            }`}
          >
            {count ?? 0}/{max}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export function SourceCreateModal({ open, saving, onClose, onSave }) {
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [cutOff, setCutOff] = useState("");
  const [err, setErr] = useState("");

  const trimmed = label.trim();

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErr("");
    if (!trimmed) {
      setErr("Give the source a label.");
      return;
    }
    await onSave({
      label: trimmed,
      notes: notes.trim(),
      date_cut_off: cutOff || null,
    });
    // Success only — if onSave throws, the lines above throw too and the
    // user's input is preserved for another attempt.
    setLabel("");
    setNotes("");
    setCutOff("");
  };

  const handleClose = () => {
    if (saving) return;
    setErr("");
    onClose?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center px-2">
            <motion.form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="source-create-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-full max-w-[500px] flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7"
            >
              <div className="flex shrink-0 items-start justify-between mb-6">
                <div className="min-w-0">
                  <h3
                    id="source-create-title"
                    className="font-display text-lg font-medium tracking-tight"
                  >
                    New source of funds
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-[var(--ink-muted)]">
                    Budgets allocate from it, issue to employees, and spend
                    against it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  aria-label="Close"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              {/* overflow-visible (not auto): the DatePicker calendar must
                  render whole below its trigger — a scrollport would clip
                  it no matter the panel's z-index. This form is short, so
                  no scroll region is lost. */}
              <div className="min-h-0 flex-1 overflow-visible">
                <div className="space-y-5">
                  <ContextCard
                    icon={
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center ring-1 ring-[var(--surface)]">
                        <Calendar1Icon size={15} />
                      </div>
                    }
                    title={today}
                    subtitle="Creation date"
                    badge="Today"
                    badgeTone="accent"
                  />
                  <Field label="Label" count={label.length} max={LABEL_MAX}>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g. Employee Budget, Office Budget, etc."
                      disabled={saving}
                      maxLength={LABEL_MAX}
                    />
                  </Field>
                  <Field label="Date cut off" optional>
                    <DatePicker
                      value={cutOff}
                      onChange={(next) => setCutOff(next || "")}
                      placeholder="Cut-off date"
                      className="text-xs"
                      disabled={saving}
                    />
                  </Field>
                  <Field
                    label="Notes"
                    optional
                    count={notes.length}
                    max={NOTES_MAX}
                  >
                    <TextArea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What is this source for…"
                      rows={2}
                      maxLength={NOTES_MAX}
                      disabled={saving}
                    />
                  </Field>
                </div>

                <AnimatePresence initial={false}>
                  {err && (
                    <motion.div
                      role="alert"
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
                      className="flex items-start gap-2 overflow-hidden text-sm text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-4"
                    >
                      <AlertCircle size={18} className="mt-px shrink-0" />
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 mt-6 pt-5 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  disabled={saving || !trimmed}
                  title={!trimmed ? "Give the source a label first" : undefined}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <Plus size={14} /> Create source
                </Button>
              </div>
            </motion.form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SourceCreateModal;
