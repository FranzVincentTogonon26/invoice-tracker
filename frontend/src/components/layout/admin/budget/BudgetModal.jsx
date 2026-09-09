import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Input, TextArea } from "../../../ui/Input";
import { Select, PAYMENT_METHODS } from "../../../ui/Select";
import { Button } from "../../../ui/Button";
import { useBudgetMutations } from "../../../../hooks/useBudget";

const initialForm = {
  description: "",
  amount: "",
  method: "",
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

const BudgetModal = ({ open, onClose }) => {
  const { create } = useBudgetMutations();
  const [form, setForm] = useState(initialForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleClose = () => {
    if (saving) return;

    setForm(initialForm);
    setErr("");
    onClose();
  };

  const handleMethodChange = (value) => {
    setForm((current) => ({
      ...current,
      method: value,
    }));

    if (err) {
      setErr("");
    }
  };

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    // form can still be null if the user submits without touching any field
    if (!form) {
      setErr("Please fill in the budget details first.");
      return;
    }

    const amount = Number(form.amount);

    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        amount,
        method: form.method,
      };
      await create.mutateAsync(payload);
      setForm(initialForm);
      setErr("");
      onClose();
    } catch (error) {
      setErr(error.message || "Couldn't save budget");
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
              className="relative w-full max-w-[480px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  Add Budget
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <Field label="Description">
                  <TextArea
                    value={form?.description}
                    onChange={set("description")}
                    placeholder="What was this for?"
                  />
                </Field>
                <Field label="Amount">
                  <Input
                    value={form?.amount}
                    onChange={set("amount")}
                    min="0"
                    type="number"
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Payment Method">
                  <Select
                    value={form?.method}
                    onChange={handleMethodChange}
                    options={PAYMENT_METHODS}
                    placeholder="Select payment method"
                  />
                </Field>
                <Field label="Date Added">
                  <div className="flex h-10 w-full items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)] outline-none">
                    {today}
                  </div>
                </Field>
                <Field label="Approved To">
                  <div className="flex h-10 w-full items-center justify-between rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)] outline-none">
                    <span>Franz Vincent</span>
                    <div className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--ink-muted)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] animate-pulse" />
                      Connected
                    </div>
                  </div>
                </Field>
              </div>
              {err && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-2xl px-4 py-4 leading-snug mt-4"
                >
                  {err}
                </motion.div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Add Budget
                </Button>
              </div>
            </motion.form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BudgetModal;
