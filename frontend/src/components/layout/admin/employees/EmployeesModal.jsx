import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Lock, Mail, UserRound, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Input } from "../../../ui/Input";

const initialForm = {
  fullname: "",
  email: "",
  password: "",
};

function Field({ label, optional, hint, children, count, max }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="type-eyebrow text-[var(--ink-muted)]">
          {label}
          {optional && (
            <span className="ml-1.5 normal-case tracking-normal font-normal text-[11px] opacity-70">
              · optional
            </span>
          )}
        </span>
        {max != null && (
          <span
            className={`text-[11px] tabular ${
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
        <span className="mt-1.5 block text-[12px] font-normal leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

// Client-side pre-flight checks mirror the backend zod schema
// (employee.validation.js) so the admin gets instant feedback before the
// request is sent.
function validateForm(f) {
  if (!f.fullname.trim() || f.fullname.trim().length < 2)
    return "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    return "Please enter a valid email address.";
  if (!f.password || f.password.length < 8)
    return "Password must be at least 8 characters.";
  return "";
}

const EmployeesModal = ({ open, onClose, create }) => {
  const [form, setForm] = useState(initialForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function onSubmit(e) {
    e.preventDefault();

    const error = validateForm(form);
    if (error) {
      setErr(error);
      return;
    }

    setErr("");
    setSaving(true);
    try {
      await create.mutateAsync({
        name: form.fullname.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success("Employee added successfully.");
      setForm(initialForm);
      onClose();
    } catch (err) {
      setErr(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center px-2">
            <motion.form
              onSubmit={onSubmit}
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="employees-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-full max-w-[500px] flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7"
            >
              <div className="flex shrink-0 items-start justify-between mb-6">
                <div className="min-w-0">
                  <h3
                    id="employees-modal-title"
                    className="text-lg font-semibold tracking-tight"
                  >
                    Add Employee
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-[var(--ink-muted)]">
                    Create an employee account. They can sign in immediately
                    with the credentials you set.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-5">
                  <Field label="Full name">
                    <Input
                      Icon={UserRound}
                      value={form.fullname}
                      onChange={set("fullname")}
                      placeholder="e.g. Juan Dela Cruz"
                      autoFocus
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      Icon={Mail}
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="name@gmail.com"
                    />
                  </Field>
                  <Field
                    label="Password"
                    hint="At least 8 characters. Share it privately with the employee."
                  >
                    <Input
                      Icon={Lock}
                      type="password"
                      value={form.password}
                      onChange={set("password")}
                      placeholder="••••••••"
                    />
                  </Field>
                </div>

                <AnimatePresence initial={false}>
                  {err && (
                    <motion.div
                      data-error
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
                      <AlertCircle size={17} className="mt-px shrink-0" />
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 mt-6 pt-5 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Adding…" : "Add Employee"}
                </Button>
              </div>
            </motion.form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmployeesModal;
