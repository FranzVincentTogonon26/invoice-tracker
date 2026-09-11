import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar1Icon, Loader2, PhilippinePesoIcon, X } from "lucide-react";
import { Input, TextArea } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { SelectEmployee } from "../../../ui/SelectEmployee";
import { Button } from "../../../ui/Button";
import toast from "react-hot-toast";

const initialForm = {
  employee: "",
  amount: "",
  method: "",
  description: "",
  note: "",
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

const BudgetModal = ({ open, transaction, onClose, create, employees = [] }) => {
  const [form, setForm] = useState(initialForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // works for both native inputs (event) and Listbox selects (raw value)
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setForm({ ...initialForm });
    setErr("");
    setSaving(false);
  }

  const handleClose = () => {
    if (saving) return;

    setForm({ ...initialForm });
    setErr("");
    onClose();
  };

  // Close on Escape while open (never while saving)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) {
        setForm({ ...initialForm });
        setErr("");
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const isAddBudget = transaction === "addBudget";

  // Client-side validation mirroring `POST /budgets` zod rules
  const validate = () => {
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
      // `POST /budgets` expects a flat body: { description, amount, method }
      const body = {
        description: form.description.trim(),
        amount: Number(form.amount),
        method: form.method,
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
      // axios interceptor rejects with `response.data` ({ message, ... })
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
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm flex items-center justify-center"
            onClick={handleClose}
          >
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
                  <Field label="Today">
                    <div className="flex h-10 w-full items-center justify-start gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)] outline-none">
                      <Calendar1Icon
                        size={16}
                        className="text-[var(--ink-muted)]"
                      />
                      <span>{today}</span>
                    </div>
                  </Field>
                  <Field label="Approved to">
                    <div className="flex h-10 w-full items-center gap-2 justify-start rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 text-sm text-[var(--ink)] outline-none">
                      <div className="h-7.5 w-7.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold flex items-center justify-center text-sm ring-2 ring-[var(--surface)] shrink-0">
                        {"F"}
                      </div>
                      <span>Franz Vincent</span>
                    </div>
                  </Field>
                  <Field label="Amount">
                    <Input
                      value={form?.amount}
                      onChange={set("amount")}
                      min="0"
                      type="number"
                      placeholder="0.00"
                      Icon={PhilippinePesoIcon}
                    />
                  </Field>
                  <Field label="Payment Method">
                    <Select
                      value={form?.method}
                      onChange={set("method")}
                      placeholder="Select payment method"
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
                  <Field label="Employee Name">
                    <SelectEmployee
                      employees={employees}
                      value={form?.employee}
                      onChange={set("employee")}
                      placeholder="Select Employee"
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Amount">
                    <Input
                      value={form?.amount}
                      onChange={set("amount")}
                      min="0"
                      type="number"
                      placeholder="0.00"
                      Icon={PhilippinePesoIcon}
                    />
                  </Field>
                  <Field label="Description">
                    <Input
                      value={form?.description}
                      onChange={set("description")}
                      placeholder="What was this for?"
                    />
                  </Field>
                  <Field label="Payment Method">
                    <Select
                      value={form?.method}
                      onChange={set("method")}
                      placeholder="Select payment method"
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Notes">
                    <TextArea
                      value={form?.note}
                      onChange={set("note")}
                      placeholder="Add note..."
                    />
                  </Field>
                </div>
              )}

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
                  {transaction === "addBudget" ? "Add Budget" : "Issue Budget"}
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
