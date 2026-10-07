import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Input, TextArea } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { SOURCE_EDIT_STATUS_OPTIONS } from "@/constants";

export function SourceEditModal({ source, saving, onClose, onSave }) {
  const [label, setLabel] = useState(source?.label ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [status, setStatus] = useState(source?.status ?? "open");
  const [err, setErr] = useState("");

  const closing = (source?.status ?? "open") === "open" && status === "cut_off";

  const handleSave = async (e) => {
    e?.preventDefault();
    setErr("");
    if (!label.trim()) {
      setErr("Give the source a label.");
      return;
    }
    await onSave(source, {
      label: label.trim(),
      notes: notes.trim(),
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <form
        onSubmit={handleSave}
        className="relative w-full max-w-[440px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-medium tracking-tight">
              Edit source
            </h3>
            <p className="mt-1 text-sm leading-snug text-[var(--ink-muted)]">
              Rename it, annotate it, or open / close it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close editor"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
              Label
            </span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Q1 Operations"
              disabled={saving}
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
              Notes <span className="opacity-70">· optional</span>
            </span>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What is this source for…"
              rows={2}
              maxLength={500}
              disabled={saving}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
              Status
            </span>
            <Select
              value={status}
              onChange={setStatus}
              options={SOURCE_EDIT_STATUS_OPTIONS}
              placeholder="Select status"
              disabled={saving}
            />
          </label>
          {closing && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--danger)]"
            >
              Closing disconnects this source from every flow — no top-ups,
              issuances, expenses, abono or transfers can use it until it is
              reopened.
            </p>
          )}
          {err && (
            <p
              role="alert"
              className="text-xs font-medium text-[var(--danger)]"
            >
              {err}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}

export default SourceEditModal;
