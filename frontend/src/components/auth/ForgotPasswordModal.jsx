import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { AuthErrorBanner, AuthField, AuthPrimaryButton } from "./AuthShell";
import { useAuth } from "@/context/AuthContext";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;
const EASE = [0.16, 1, 0.3, 1];

/**
 * "Forgot password" flow, opened from the Login page. One panel, four steps:
 *
 *   email    → the address is validated against the users table first;
 *              unknown emails get an explicit denial
 *   otp      → admins only: verify the 6-digit code emailed to them
 *   password → choose (and confirm) the new password
 *   done     → success confirmation
 *
 * Employees skip the OTP step — once their email is validated the flow moves
 * straight to the password step and the backend saves it directly.
 *
 * Visual contract: the panel rides a `layout` animation so its height morphs
 * smoothly between steps (never collapsing), and each step's badge/heading/
 * fields stagger in — same entrance choreography as the registration OtpModal.
 */
export function ForgotPasswordModal({ open, onClose, onDone }) {
  return (
    <AnimatePresence>
      {open && <ForgotPasswordContent onClose={onClose} onDone={onDone} />}
    </AnimatePresence>
  );
}

function ForgotPasswordContent({ onClose, onDone }) {
  const { forgotPassword, verifyResetOtp, resendResetOtp, resetPassword } =
    useAuth();

  const [step, setStep] = useState("email"); // email | otp | password | done
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(null); // known once the email is checked
  const [resetToken, setResetToken] = useState("");

  // Escape closes the modal (same behaviour as the registration OTP modal)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // ── Step handlers — each throws on failure so the step that called it
  //    renders the error inline (same contract as OtpModal.onVerify). ────────

  async function submitEmail() {
    const nextEmail = email.trim();
    const { role: checkedRole } = await forgotPassword({ email: nextEmail });
    setEmail(nextEmail);
    setRole(checkedRole);
    // Admins prove ownership with an emailed code; employees set the new
    // password directly.
    setStep(checkedRole === "admin" ? "otp" : "password");
  }

  async function submitCode(code) {
    const { resetToken: token } = await verifyResetOtp({ email, otp: code });
    setResetToken(token);
    setStep("password");
  }

  async function resendCode() {
    await resendResetOtp({ email });
  }

  async function submitPassword(password) {
    await resetPassword({
      email,
      password,
      // Admins carry the proof from the OTP step; employees send none.
      resetToken: resetToken || undefined,
    });
    setStep("done");
  }

  // Progress dots — the admin path adds the OTP hop, employees don't.
  const path =
    role === "admin"
      ? ["email", "otp", "password"]
      : role === "employee"
        ? ["email", "password"]
        : ["email"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "rgba(7, 26, 24, 0.45)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={onClose}
      />

      {/* Panel — `layout` morphs its height smoothly as steps swap */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        layout
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-[var(--surface)] border border-[var(--border)] shadow-[0_24px_70px_-20px_rgba(13,42,37,0.4)]"
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 h-9 w-9 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-7 sm:px-8 pt-8 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              {step === "email" && (
                <>
                  <StepBadge icon={Mail} />
                  <StepDots path={path} current={step} />
                  <StepHeading
                    id="forgot-password-title"
                    eyebrow="Account check"
                    title="Reset your password"
                    desc="Enter the email registered to your account and we'll check it first."
                  />
                  <EmailStep
                    value={email}
                    onChange={setEmail}
                    onSubmit={submitEmail}
                  />
                </>
              )}

              {step === "otp" && (
                <>
                  <StepBadge icon={MailCheck} />
                  <StepDots path={path} current={step} />
                  <StepHeading
                    id="forgot-password-title"
                    eyebrow="Security code"
                    title="Verify it's you"
                    desc={
                      <>
                        We sent a 6-digit code to{" "}
                        <span className="font-medium text-[var(--ink)]">
                          {email}
                        </span>
                        . Enter it below to continue.
                      </>
                    }
                  />
                  <OtpStep
                    onVerify={submitCode}
                    onResend={resendCode}
                    onBack={() => {
                      // Not the right address? Return to the email step —
                      // any half-verified code stays harmless.
                      setResetToken("");
                      setStep("email");
                    }}
                  />
                </>
              )}

              {step === "password" && (
                <>
                  <StepBadge icon={KeyRound} />
                  <StepDots path={path} current={step} />
                  <StepHeading
                    id="forgot-password-title"
                    eyebrow="New password"
                    title="Set a new password"
                    desc={
                      <>
                        Choose a new password for{" "}
                        <span className="font-medium text-[var(--ink)]">
                          {email}
                        </span>
                        .
                      </>
                    }
                  />
                  <PasswordStep onSubmit={submitPassword} />
                </>
              )}

              {step === "done" && (
                <>
                  <StepBadge icon={CheckCircle2} success />
                  <StepHeading
                    id="forgot-password-title"
                    eyebrow="All set"
                    title="Password updated"
                    desc={
                      <>
                        You can now sign in to Budget Tracker with your new
                        password
                        {email ? (
                          <>
                            {" "}
                            (
                            <span className="font-medium text-[var(--ink)]">
                              {email}
                            </span>
                            )
                          </>
                        ) : null}
                        .
                      </>
                    }
                  />
                  <div className="mt-7">
                    <AuthPrimaryButton
                      type="button"
                      onClick={() => {
                        onDone?.(email);
                        onClose?.();
                      }}
                    >
                      Back to sign in <ArrowRight size={15} />
                    </AuthPrimaryButton>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Trust strip */}
          <div className="mt-7 pt-4 border-t border-[var(--border)] flex items-center justify-center gap-2 text-[11px] tracking-tight text-[var(--ink-muted)]/80">
            <ShieldCheck
              size={12}
              className="text-[var(--accent-strong)] shrink-0"
            />
            Budget Tracker keeps your account protected
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StepBadge({ icon: Icon, success = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: 0.08,
        duration: 0.45,
        ...(success ? { type: "spring", stiffness: 320, damping: 20 } : {}),
      }}
      className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center"
    >
      <Icon size={20} />
    </motion.div>
  );
}

/* Tiny progress pills under the badge — only shown once the flow's shape
   is known (i.e. after the email was checked). Completed hops light up. */
function StepDots({ path, current }) {
  if (path.length < 2 || !path.includes(current)) return null;

  const currentIdx = path.indexOf(current);

  return (
    <div className="mt-4 flex items-center gap-1.5" aria-hidden>
      {path.map((s, i) => (
        <motion.span
          key={s}
          initial={{ width: s === current ? 18 : 6 }}
          animate={{ width: s === current ? 18 : 6 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={`h-1.5 rounded-full ${
            s === current
              ? "bg-[var(--accent)]"
              : i < currentIdx
                ? "bg-[var(--accent)]/40"
                : "bg-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

function StepHeading({ id, eyebrow, title, desc }) {
  return (
    <>
      <p className="type-eyebrow text-[11px] tracking-[0.16em] text-[var(--accent-strong)] uppercase font-medium mt-5">
        {eyebrow}
      </p>
      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: EASE }}
        id={id}
        className="font-display text-xl font-medium tracking-tight text-[var(--ink)] mt-1.5"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09, duration: 0.4, ease: EASE }}
        className="text-[var(--ink-muted)] mt-1.5 text-sm leading-relaxed"
      >
        {desc}
      </motion.p>
    </>
  );
}

function VisibilityToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)]/70 hover:text-[var(--ink)] transition-colors"
    >
      {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
    </button>
  );
}

/* Step 1 — the email the reset will apply to. */
function EmailStep({ value, onChange, onSubmit }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await onSubmit();
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={onChange}
        placeholder="you@example.com"
        icon={Mail}
        autoFocus
      />

      <AuthErrorBanner>{error}</AuthErrorBanner>

      <div className="pt-1">
        <AuthPrimaryButton type="submit" disabled={busy || !value.trim()}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Checking email...
            </>
          ) : (
            <>
              Continue <ArrowRight size={15} />
            </>
          )}
        </AuthPrimaryButton>
      </div>
    </form>
  );
}

/* Step 2 (admins only) — the emailed 6-digit code, with resend cooldown.
   Same box behaviour as the registration OtpModal. */
function OtpStep({ onVerify, onResend, onBack }) {
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  const inputsRef = useRef([]);

  // Focus the first input once the step transition has settled
  useEffect(() => {
    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 320);

    return () => clearTimeout(t);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;

    const id = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [resendIn]);

  const isComplete = code.every((digit) => digit !== "");

  function focusBox(i) {
    const index = Math.min(Math.max(i, 0), CODE_LENGTH - 1);

    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select?.();
  }

  function handleChange(index, raw) {
    const digits = raw.replace(/\D/g, "");

    if (!digits) return;

    setError("");

    setCode((prev) => {
      const next = [...prev];

      let i = index;

      for (const digit of digits) {
        if (i >= CODE_LENGTH) break;

        next[i] = digit;
        i += 1;
      }

      return next;
    });

    focusBox(index + digits.length);
  }

  function handleKeyDown(index, e) {
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusBox(index + 1);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      setError("");

      setCode((prev) => {
        const next = [...prev];

        if (next[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
        }

        return next;
      });

      if (!code[index] && index > 0) {
        focusBox(index - 1);
      }
    }
  }

  async function handleVerify() {
    if (!isComplete || verifying) return;

    setVerifying(true);
    setError("");

    try {
      await onVerify?.(code.join(""));
    } catch (e) {
      setError(e?.message || "Verification failed. Please try again.");

      setVerifying(false);
      setCode(Array(CODE_LENGTH).fill(""));
      focusBox(0);
    }
  }

  async function handleResend() {
    if (resending || resendIn > 0) return;

    setResending(true);
    setError("");

    try {
      // Asks the backend to email a fresh code via Resend
      await onResend?.();
      setResendIn(RESEND_SECONDS);
      setCode(Array(CODE_LENGTH).fill(""));
      focusBox(0);
    } catch (e) {
      setError(e?.message || "Could not resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      {/* Code boxes */}
      <div className="flex gap-2.5 mt-7" aria-label="Verification code">
        {code.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: 0.12 + i * 0.05,
              ease: EASE,
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Digit ${i + 1}`}
            maxLength={CODE_LENGTH}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={`h-14 w-full flex-1 rounded-2xl border text-center font-display text-2xl font-medium tabular-nums tracking-tight text-[var(--ink)] outline-none transition-all duration-200 focus:bg-[var(--surface)] focus:border-[var(--accent)]/40 focus:ring-4 focus:ring-[var(--accent)]/10 ${
              digit
                ? "border-[var(--accent)]/40 bg-[var(--surface)]"
                : "border-[var(--border)] bg-[var(--surface-2)]"
            }`}
          />
        ))}
      </div>

      {/* Error (only occupies space while there is one) */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="otp-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <AuthErrorBanner>{error}</AuthErrorBanner>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6">
        <AuthPrimaryButton
          type="button"
          onClick={handleVerify}
          disabled={!isComplete || verifying}
        >
          {verifying ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify code"
          )}
        </AuthPrimaryButton>
      </div>

      {/* Resend */}
      <div className="text-sm text-[var(--ink-muted)] text-center mt-5">
        Didn't get the code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || resending}
          className="inline-flex items-center gap-1.5 text-[var(--accent-strong)] font-medium hover:underline disabled:text-[var(--ink-muted)] disabled:no-underline disabled:cursor-not-allowed"
        >
          {resending && <Loader2 size={12} className="animate-spin" />}
          {resendIn > 0
            ? `Resend in 0:${String(resendIn).padStart(2, "0")}`
            : "Resend code"}
        </button>
      </div>

      {/* Escape hatch — wrong address? go back and fix it */}
      <div className="text-center mt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft size={12} /> Use a different email
        </button>
      </div>

      <p className="text-xs text-[var(--ink-muted)]/80 text-center mt-4 leading-relaxed">
        For your security, this code expires in 10 minutes.
      </p>
    </>
  );
}

/* Step 3 — the new password (with confirmation, live match state and
   show/hide toggles). */
function PasswordStep({ onSubmit }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = confirm.length > 0 && confirm === password;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSubmit(password);
    } catch (err) {
      setError(
        err?.message || "Could not update the password. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <AuthField
        label="New password"
        type={showPw ? "text" : "password"}
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
        minLength={8}
        icon={Lock}
        autoFocus
        trailing={
          <VisibilityToggle
            shown={showPw}
            onToggle={() => setShowPw((s) => !s)}
          />
        }
      />

      <AuthField
        label="Confirm new password"
        type={showConfirm ? "text" : "password"}
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Re-enter password"
        icon={Lock}
        trailing={
          <VisibilityToggle
            shown={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
          />
        }
        extra={
          confirm.length > 0 && (
            <span
              className={`text-xs font-medium tracking-tight inline-flex items-center gap-1 ${
                matches
                  ? "text-[var(--accent-strong)]"
                  : "text-[var(--warning)]"
              }`}
            >
              {matches ? (
                <>
                  <Check size={11} strokeWidth={3} /> Match
                </>
              ) : (
                "Not matching"
              )}
            </span>
          )
        }
      />

      <AuthErrorBanner>{error}</AuthErrorBanner>

      <div className="pt-1">
        <AuthPrimaryButton
          type="submit"
          disabled={busy || !password || !confirm}
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              Update password <Check size={15} strokeWidth={2.5} />
            </>
          )}
        </AuthPrimaryButton>
      </div>
    </form>
  );
}
