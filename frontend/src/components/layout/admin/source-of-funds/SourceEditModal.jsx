import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Calendar1Icon, Loader2, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { DatePicker } from "../../../ui/DatePicker";
import { Input, TextArea } from "../../../ui/Input";
import { formatDate } from "@/lib/utils";

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

// DB timestamptz serializes as a full ISO string — the picker speaks
// date-only `YYYY-MM-DD`, so normalize on the way in. Slicing keeps the
// stored calendar day instead of re-interpreting it across timezones.
const toDateOnly = (value) => {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
};

export function SourceEditModal({ source, saving, onClose, onSave }) {
  const [label, setLabel] = useState(source?.label ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [cutOff, setCutOff] = useState(toDateOnly(source?.date_cut_off));
  const [err, setErr] = useState("");

  // Stale-props fix: the modal stays mounted while the admin picks another
  // row, so re-seed the fields whenever a different source arrives —
  // otherwise the previous source's values leak into the next edit.
  // Adjusted during render (not in an effect): React re-renders immediately
  // without committing, so no cascading render — same pattern BudgetModal
  // uses for its form reset.
  const sourceKey = source?.reference_id ?? null;
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  if (sourceKey !== prevSourceKey) {
    setPrevSourceKey(sourceKey);
    setLabel(source?.label ?? "");
    setNotes(source?.notes ?? "");
    setCutOff(toDateOnly(source?.date_cut_off));
    setErr("");
  }

  useEffect(() => {
    if (!source) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape" && !saving) {
        setErr("");
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [source, saving, onClose]);

  if (!source) return null;

  const trimmed = label.trim();

  const handleSave = async (e) => {
    e?.preventDefault();
    setErr("");
    if (!trimmed) {
      setErr("Give the source a label.");
      return;
    }
    await onSave(source, {
      label: trimmed,
      notes: notes.trim(),
      date_cut_off: cutOff || null,
    });
  };

  const handleClose = () => {
    if (saving) return;
    setErr("");
    onClose?.();
  };

  const isCutOff = source.status === "cut_off";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center px-2"
          onClick={handleClose}
        >
          <motion.form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="source-edit-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex w-full max-w-[500px] flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7"
          >
            <div className="flex shrink-0 items-start justify-between mb-6">
              <div className="min-w-0">
                <h3
                  id="source-edit-title"
                  className="font-display text-lg font-medium tracking-tight"
                >
                  Edit source
                </h3>
                <p className="mt-1 truncate text-sm leading-snug text-[var(--ink-muted)]">
                  {source.label || "Untitled source"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                aria-label="Close editor"
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
                  title={
                    source.created_at
                      ? formatDate(source.created_at)
                      : "Unknown date"
                  }
                  subtitle="Creation date"
                  badge={isCutOff ? "Cut off" : "Open"}
                  badgeTone={isCutOff ? "warning" : "accent"}
                />
                <Field label="Label" count={label.length} max={LABEL_MAX}>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Q1 Operations"
                    disabled={saving}
                    maxLength={LABEL_MAX}
                  />
                </Field>
                <Field label="Date cut off" optional>
                  <DatePicker
                    value={cutOff}
                    onChange={(next) => setCutOff(next || "")}
                    placeholder="Cut-off date"
                    minDate={new Date()}
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
                Save changes
              </Button>
            </div>
          </motion.form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SourceEditModal;
