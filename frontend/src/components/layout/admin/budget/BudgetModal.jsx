import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar1Icon,
  Loader2,
  PhilippinePesoIcon,
  AlertCircle,
  X,
  Plus,
} from "lucide-react";
import { Input, TextArea } from "../../../ui/Input";
import { Badge } from "../../../ui/Badge";
import { Select } from "../../../ui/Select";
import { SelectEmployee } from "../../../ui/SelectEmployee";
import { SelectReference } from "../../../ui/SelectReference";
import { Button } from "../../../ui/Button";
import ReferencesModal from "./ReferencesModal";
import toast from "react-hot-toast";

// Approver is fixed for now (admin-issued budgets are always self-approved)
const APPROVER = "Franz Vincent";

const initialForm = {
  reference_id: "",
  employee: "",
  amount: "",
  method: "",
  description: "",
  note: "",
};

// Soft client-side length caps for the text areas (the backend has no hard
// limit; these keep entries tidy and power the live character counters).
const DESCRIPTION_MAX = 200;
const NOTE_MAX = 150;

// Quick-fill amounts for the money input — one tap fills the field, avoiding
// typos on numeric keyboards. Values match common budget tranches.
const AMOUNT_PRESETS = [500, 1000, 2500, 5000];

function Field({ label, optional, hint, children, count, max }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          {label}
          {optional && (
            <span className="ml-1.5 normal-case tracking-normal font-normal text-[10px] opacity-70">
              · optional
            </span>
          )}
        </span>
        {max != null && (
          <span
            className={`text-[10px] tabular ${
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
      {hint && (
        <span className="mt-1.5 block text-[11px] font-normal leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

// Compact read-only context strip — fixed metadata (date, approver) shown as
// one summary card instead of stacked display rows, so users don't click
// expecting to type (borderless controls, muted subtitle, non-interactive)
function ContextCard({ icon, title, subtitle, badge, badgeTone = "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3 shadow-card">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
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

// Money input with a live formatted peso preview and one-tap quick-fill
// presets — confirms the parsed amount at a glance and avoids typos on
// numeric keyboards. Kept here (not in ui/) since it is budget-form specific.
function AmountInput({ value, onChange, disabled }) {
  const parsed = Number(value);
  const preview =
    String(value ?? "").trim() !== "" && !Number.isNaN(parsed)
      ? parsed.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
      : null;

  return (
    <div>
      <Input
        value={value}
        onChange={onChange}
        min="0"
        step="0.01"
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        disabled={disabled}
        Icon={PhilippinePesoIcon}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={`truncate text-[11px] font-medium tabular leading-snug ${
            preview ? "text-[var(--accent-strong)]" : "text-[var(--ink-muted)]"
          }`}
        >
          {preview ?? "Philippine peso (₱)"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ target: { value: String(preset) } })}
              className="h-6 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[10px] font-semibold tabular text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent-strong)] disabled:opacity-50"
            >
              ₱{preset.toLocaleString("en-PH")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const BudgetModal = ({
  open,
  transaction,
  onClose,
  create,
  employees = [],
  budgetReferences = [],
}) => {
  const [form, setForm] = useState(initialForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [references, setReferences] = useState(budgetReferences);
  const [refsOpen, setRefsOpen] = useState(false);

  // Sync local list with the prop during render (same pattern as `prevOpen`
  // below) — avoids a cascading re-render from setState-in-effect.
  const [prevRefs, setPrevRefs] = useState(budgetReferences);
  if (budgetReferences !== prevRefs) {
    setPrevRefs(budgetReferences);
    setReferences(budgetReferences);
  }

  const addReference = async (created) => {
    setReferences((prev) => [created, ...prev]);
    setForm((f) => ({ ...f, reference_id: created.reference_id }));
  };

  const removeReference = (referenceId) => {
    setReferences((prev) => prev.filter((r) => r.reference_id !== referenceId));
    setForm((f) =>
      f.reference_id === referenceId ? { ...f, reference_id: "" } : f,
    );
  };

  const refsOpenRef = useRef(false);
  useEffect(() => {
    refsOpenRef.current = refsOpen;
  }, [refsOpen]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setForm({ ...initialForm });
    setErr("");
    setSaving(false);
    setRefsOpen(false);
  }

  const handleClose = () => {
    if (saving) return;

    setForm({ ...initialForm });
    setErr("");
    setRefsOpen(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (refsOpenRef.current) return;
      if (e.key === "Escape" && !saving) {
        setForm({ ...initialForm });
        setErr("");
        setRefsOpen(false);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const isAddBudget = transaction === "addBudget";

  // Client-side validation mirroring `POST /budgets` zod rules
  const validate = () => {
    if (isAddBudget && !form.reference_id)
      return "Please select a budget reference first.";
    if (!form.employee && !isAddBudget)
      return "Please select an employee first.";
    if (!form.method) return "Please select a payment method.";
    if (!form.description || form.description.trim().length < 2)
      return "Description is required.";
    if (!String(form.amount).trim()) return "Amount is required.";

    const amount = Number(form.amount);
    if (Number.isNaN(amount)) return "Amount must be a valid number.";
    if (amount <= 0) return "Amount must be greater than zero.";

    return "";
  };

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    setSaving(true);
    try {
      const body = isAddBudget
        ? {
            type: "addBudget",
            reference_id: form.reference_id,
            amount: form.amount,
            method: form.method,
            description: form.description,
            approved: APPROVER,
          }
        : {
            type: "issuedBudget",
            reference_id: form.reference_id,
            employeeId: form.employee,
            amount: form.amount,
            method: form.method,
            description: form.description,
            note: form.note,
          };

      await create.mutateAsync(body);
      setForm({ ...initialForm });
      setErr("");
      onClose();
      toast.success(
        isAddBudget
          ? "Budget added successfully!"
          : "Budget issued successfully!",
      );
    } catch (error) {
      setErr(error?.message || "Couldn't save budget");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm flex items-center justify-center">
            <motion.form
              onSubmit={onSubmit}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[500px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {transaction === "addBudget" ? "Add Budget" : "Issued Budget"}
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              {transaction === "addBudget" ? (
                <div className="space-y-3">
                  {/* Read-only context strip: date + approver, collapsed into one
                      summary card instead of two stacked display rows */}
                  <ContextCard
                    icon={
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold text-sm flex items-center justify-center ring-1 ring-[var(--surface)]">
                        {APPROVER.charAt(0)}
                      </div>
                    }
                    title={APPROVER}
                    subtitle={
                      <span className="flex items-center gap-1.5">
                        <Calendar1Icon size={11} className="shrink-0" />
                        {today}
                      </span>
                    }
                    badge="Approver"
                  />

                  <Field
                    label="Budget Reference"
                    hint="Select the budget reference (source and date)."
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <SelectReference
                          references={references}
                          value={form?.reference_id}
                          onChange={set("reference_id")}
                          placeholder="Select budget source"
                          disabled={saving}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="soft"
                        size="icon"
                        onClick={() => setRefsOpen(true)}
                        disabled={saving}
                        aria-label="Add new reference"
                        title="Add new reference"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Amount">
                    <AmountInput
                      value={form?.amount}
                      onChange={set("amount")}
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Transaction Method">
                    <Select
                      value={form?.method}
                      onChange={set("method")}
                      placeholder="Select transaction method"
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Description">
                    <TextArea
                      value={form?.description}
                      onChange={set("description")}
                      placeholder="What was this for?"
                    />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Read-only context strip: today's issuance date */}
                  <ContextCard
                    icon={
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center ring-1 ring-[var(--surface)]">
                        <Calendar1Icon size={15} />
                      </div>
                    }
                    title={today}
                    subtitle="Issuance date"
                    badge="Today"
                    badgeTone="accent"
                  />
                  <Field
                    label="Budget Reference"
                    hint="Select the budget reference (source and date)."
                  >
                    <SelectReference
                      references={references}
                      value={form?.reference_id}
                      onChange={set("reference_id")}
                      placeholder="Select budget source"
                      disabled={saving}
                    />
                  </Field>
                  <Field
                    label="Employee"
                    hint="The budget will be issued to this employee."
                  >
                    <SelectEmployee
                      employees={employees}
                      value={form?.employee}
                      onChange={set("employee")}
                      placeholder="Select employee"
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Amount">
                    <AmountInput
                      value={form?.amount}
                      onChange={set("amount")}
                      disabled={saving}
                    />
                  </Field>
                  <Field
                    label="Transaction Method"
                    hint="How the budget will be released."
                  >
                    <Select
                      value={form?.method}
                      onChange={set("method")}
                      placeholder="Select transaction method"
                      disabled={saving}
                    />
                  </Field>
                  <Field
                    label="Description"
                    hint="A short summary shown in the transaction list."
                    count={(form?.description || "").length}
                    max={DESCRIPTION_MAX}
                  >
                    <TextArea
                      value={form?.description}
                      onChange={set("description")}
                      placeholder="What was this for?"
                      maxLength={DESCRIPTION_MAX}
                      rows={2}
                    />
                  </Field>
                  <Field
                    label="Notes"
                    optional
                    count={(form?.note || "").length}
                    max={NOTE_MAX}
                  >
                    <TextArea
                      value={form?.note}
                      onChange={set("note")}
                      placeholder="Add note..."
                      maxLength={NOTE_MAX}
                      rows={2}
                    />
                  </Field>
                </div>
              )}

              {err && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-4"
                >
                  <AlertCircle size={14} className="mt-px shrink-0" />
                  {err}
                </motion.div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6 pt-5 border-t border-[var(--border)]">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {transaction === "addBudget" ? "Add Budget" : "Issue Budget"}
                </Button>
              </div>
            </motion.form>

            {/* Nested modal: reference id table + add-new-reference form */}
            <ReferencesModal
              open={refsOpen}
              references={references}
              onAdd={addReference}
              onDelete={removeReference}
              onClose={() => setRefsOpen(false)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BudgetModal;
