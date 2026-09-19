import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MailCheck, X } from "lucide-react";
import { AuthPrimaryButton } from "./AuthShell";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;
const EASE = [0.16, 1, 0.3, 1];

export function OtpModal({ open, email, onClose, onVerify, onResend }) {
  return (
    <AnimatePresence>
      {open && (
        <OtpModalContent
          email={email}
          onClose={onClose}
          onVerify={onVerify}
          onResend={onResend}
        />
      )}
    </AnimatePresence>
  );
}

function OtpModalContent({ email, onClose, onVerify, onResend }) {
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  const inputsRef = useRef([]);

  // Focus the first input when the modal mounts
  useEffect(() => {
    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 380);

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

  // Escape closes the modal
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
        transition={{
          duration: 0.3,
          ease: "easeOut",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Verify your email"
        initial={{
          opacity: 0,
          y: 28,
          scale: 0.96,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: 16,
          scale: 0.97,
        }}
        transition={{
          duration: 0.45,
          ease: EASE,
        }}
        className="relative w-full max-w-[420px] rounded-[28px] bg-[var(--surface)] border border-[var(--border)] px-7 sm:px-8 py-8 shadow-[0_24px_70px_-20px_rgba(13,42,37,0.4)]"
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 h-9 w-9 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Icon badge */}
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.7,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            delay: 0.12,
            duration: 0.45,
            ease: EASE,
          }}
          className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center"
        >
          <MailCheck size={20} />
        </motion.div>

        {/* Title */}
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--ink)] mt-5">
          Verify your email
        </h2>

        {/* Description */}
        <p className="text-[var(--ink-muted)] mt-1.5 text-sm leading-relaxed">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-[var(--ink)]">{email}</span>.
          Enter it below to continue.
        </p>

        {/* Code boxes */}
        <div className="flex gap-2.5 mt-7" aria-label="Verification code">
          {code.map((digit, i) => (
            <motion.input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.35,
                delay: 0.18 + i * 0.05,
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
              className={`h-14 w-full flex-1 rounded-2xl border text-center font-display text-2xl font-semibold text-[var(--ink)] outline-none transition-all duration-200 focus:bg-[var(--surface)] focus:border-[var(--accent)]/40 focus:ring-4 focus:ring-[var(--accent)]/10 sm:text-xl ${
                digit
                  ? "border-[var(--accent)]/40 bg-[var(--surface)]"
                  : "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{
              opacity: 0,
              y: -4,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-2xl px-4 py-4 leading-snug mt-4"
          >
            {error}
          </motion.div>
        )}

        {/* Verify */}
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
              "Verify email"
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
            className="inline-flex items-center gap-1.5 text-[var(--accent-strong)] font-semibold hover:underline disabled:text-[var(--ink-muted)] disabled:no-underline disabled:cursor-not-allowed"
          >
            {resending && <Loader2 size={12} className="animate-spin" />}
            {resendIn > 0
              ? `Resend in 0:${String(resendIn).padStart(2, "0")}`
              : "Resend code"}
          </button>
        </div>

        {/* Expiration */}
        <p className="text-[11px] text-[var(--ink-muted)]/80 text-center mt-5 leading-relaxed">
          For your security, this code expires in 10 minutes.
        </p>
      </motion.div>
    </div>
  );
}
