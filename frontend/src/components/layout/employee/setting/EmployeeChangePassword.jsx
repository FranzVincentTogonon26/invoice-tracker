import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { Button } from "../../../ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { Input } from "../../../ui/Input";
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import { useAuth } from "@/context/AuthContext";
import { useEmployeeSettingsMutations } from "@/hooks/useEmployeeSettings";
import { cn } from "@/lib/utils";

// Mirrors the backend schemas: loginSchema's minimum for the current password,
// registerSchema's (and updatePasswordSchema's) minimum for the new one.
const MIN_CURRENT_LENGTH = 6;
const MIN_NEW_LENGTH = 8;

const FieldLabel = ({ children }) => (
  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
    {children}
  </p>
);

const FieldError = ({ children }) => (
  <p
    role="alert"
    className="mt-1.5 text-[11px] font-medium text-[var(--danger)]"
  >
    {children}
  </p>
);

// Show/hide toggle for a password field (the input keeps room with pr-11).
const PasswordToggle = ({ shown, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={shown ? `Hide ${label}` : `Show ${label}`}
    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
  >
    {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
  </button>
);

// One line of the confirmation summary.
const SummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <p className="shrink-0 text-sm text-[var(--ink-muted)]">{label}</p>
    <p className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
      {value}
    </p>
  </div>
);

// 0-4 score for the animated strength bar. Guidance only — the backend
// enforces the 8-character minimum; this just nudges toward a stronger mix.
const strengthOf = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_NEW_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
};

const STRENGTH_META = [
  { label: "Too short", bar: "bg-[var(--danger)]", width: "15%" },
  { label: "Weak", bar: "bg-[var(--danger)]", width: "35%" },
  { label: "Fair", bar: "bg-[var(--warning)]", width: "60%" },
  { label: "Good", bar: "bg-[var(--accent)]", width: "80%" },
  { label: "Strong", bar: "bg-[var(--success)]", width: "100%" },
];

const EmployeeChangePassword = () => {
  const nav = useNavigate();
  const { logout } = useAuth();
  const { updatePassword } = useEmployeeSettingsMutations();
  const saving = updatePassword.isPending;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const strength = strengthOf(next);
  const strengthMeta = STRENGTH_META[strength];

  // Field setters clear their own error as soon as the user types.
  const set = (setter, errorKey) => (event) => {
    setter(event.target.value);
    setErrors((prev) => {
      if (!prev[errorKey]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[errorKey];
      return nextErrors;
    });
  };

  const toggleShow = (key) =>
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));

  // Validated BEFORE the confirmation modal opens, so the final gate can never
  // fire an invalid request.
  const validate = () => {
    const nextErrors = {};

    if (!current) nextErrors.current = "Enter your current password.";
    else if (current.length < MIN_CURRENT_LENGTH)
      nextErrors.current = `Current password must be at least ${MIN_CURRENT_LENGTH} characters.`;

    if (!next) nextErrors.next = "Enter a new password.";
    else if (next.length < MIN_NEW_LENGTH)
      nextErrors.next = `New password must be at least ${MIN_NEW_LENGTH} characters.`;
    else if (next === current)
      nextErrors.next = "New password must be different from the current one.";

    if (!confirm) nextErrors.confirm = "Confirm your new password.";
    else if (confirm !== next) nextErrors.confirm = "Passwords don't match.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 1 — Update only validates; nothing is sent yet.
  const handleSubmitClick = (event) => {
    event.preventDefault();
    if (saving) return;
    if (!validate()) return;
    setConfirmOpen(true);
  };

  // Step 2 — the confirmation modal's confirm: runs the request, then ends the
  // session so the next login starts fresh with the new password.
  const handleConfirmUpdate = async () => {
    if (saving || !validate()) {
      setConfirmOpen(false);
      return;
    }

    try {
      await updatePassword.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });

      setConfirmOpen(false);
      // Fresh session: logout() drops the stored token from localStorage and
      // the user state, then /login starts a brand new session.
      toast.success("Password updated. Please sign in again.");
      logout();
      nav("/login", { replace: true });
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err?.message || "Couldn't update your password");
    }
  };

  const confirmSummary = (
    <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <SummaryRow label="New password" value={`${next.length} characters`} />
      <SummaryRow label="Strength" value={strengthMeta.label} />
      <SummaryRow label="This session" value="Ends after saving" />
    </div>
  );

  return (
    <Card padding="lg" className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription className="mt-1">
            Use at least 8 characters. Mix letters, numbers, and a symbol for a
            stronger password.
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmitClick} className="space-y-4">
        <div>
          <FieldLabel>Current password</FieldLabel>
          <div className="relative">
            <Input
              type={show.current ? "text" : "password"}
              value={current}
              onChange={set(setCurrent, "current")}
              placeholder="Your current password"
              autoComplete="current-password"
              disabled={saving}
              className="pr-11"
              aria-invalid={Boolean(errors.current) || undefined}
            />
            <PasswordToggle
              shown={show.current}
              onToggle={() => toggleShow("current")}
              label="current password"
            />
          </div>
          {errors.current && <FieldError>{errors.current}</FieldError>}
        </div>

        <div>
          <FieldLabel>New password</FieldLabel>
          <div className="relative">
            <Input
              type={show.next ? "text" : "password"}
              value={next}
              onChange={set(setNext, "next")}
              placeholder="Your new password"
              autoComplete="new-password"
              disabled={saving}
              className="pr-11"
              aria-invalid={Boolean(errors.next) || undefined}
            />
            <PasswordToggle
              shown={show.next}
              onToggle={() => toggleShow("next")}
              label="new password"
            />
          </div>

          {/* Live strength meter — the bar width animates between steps. */}
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <motion.div
                className={cn("h-full rounded-full", strengthMeta.bar)}
                initial={false}
                animate={{ width: next ? strengthMeta.width : "0%" }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            {next ? (
              <motion.span
                key={strengthMeta.label}
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="w-16 shrink-0 text-right text-[11px] font-medium text-[var(--ink-muted)]"
              >
                {strengthMeta.label}
              </motion.span>
            ) : null}
          </div>

          {errors.next && <FieldError>{errors.next}</FieldError>}
        </div>

        <div>
          <FieldLabel>Confirm new password</FieldLabel>
          <div className="relative">
            <Input
              type={show.confirm ? "text" : "password"}
              value={confirm}
              onChange={set(setConfirm, "confirm")}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              disabled={saving}
              className="pr-11"
              aria-invalid={Boolean(errors.confirm) || undefined}
            />
            <PasswordToggle
              shown={show.confirm}
              onToggle={() => toggleShow("confirm")}
              label="confirm password"
            />
          </div>
          {errors.confirm && <FieldError>{errors.confirm}</FieldError>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <p className="mr-auto text-[11px] text-[var(--ink-muted)]">
            You&apos;ll be signed out after the password changes.
          </p>
          <Button type="submit" variant="accent" disabled={saving}>
            {saving && (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            )}
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>

      {/* Final gate — the request only runs from here, after the validated
          summary above was confirmed. */}
      <ConfirmActionDialog
        open={confirmOpen}
        icon={<KeyRound size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Change your password?"
        description="Your password will be updated and this session will end — sign in again with the new password."
        summary={confirmSummary}
        cancelLabel="Go back"
        confirmLabel="Yes, change password"
        confirmVariant="accent"
        pendingLabel="Updating…"
        pending={saving}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmUpdate}
      />
    </Card>
  );
};

export default EmployeeChangePassword;

