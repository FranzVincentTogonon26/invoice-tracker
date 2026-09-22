import { motion } from "framer-motion";
import {
  AuthShell,
  AuthErrorBanner,
  AuthField,
  AuthPrimaryButton,
} from "@/components/auth/AuthShell";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { OtpModal } from "@/components/auth/OtpModal";

export default function Register() {
  const { register, issuedOtp, verifyOtp, resendOtp } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setLoading(true);
    try {
      // Creates the account — the backend emails the OTP via Resend
      await issuedOtp({ email: form.email, name: form.name });
      setShowOtp(true);
    } catch (e) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // Called by the OTP modal when the user submits the 6-digit code
  async function onVerified(code) {
    await verifyOtp({ email: form.email, otp: code });
    setShowOtp(false);
    try {
      const result = await register(form);

      // Admins receive a token at registration — start the session and go
      // straight to the dashboard.
      if (result.token) {
        nav("/dashboard");
        return;
      }

      // Employees get no token (pending approval) — stay on this page and
      // explain why, instead of showing it as an error.
      setNotice(
        result.message ||
          "Your account is awaiting administrator approval.",
      );
      setForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (err) {
      setErr(err.message || "Something went wrong during registration.");
    }
  }

  // Called by the OTP modal's resend button
  async function onResend() {
    await resendOtp({ email: form.email, name: form.name });
  }
  return (
    <AuthShell
      headline={
        <>
          Get paid faster,
          <br />
          <em style={{ fontStyle: "italic" }}>with less effort.</em>
        </>
      }
      subhead="Beautiful invoices, client tracking, and AI that reads receipts, drafts reminders, and summarizes your revenue."
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] leading-[1.05]">
          Get started
        </h1>
        <p className="text-[var(--ink-muted)] mt-2 text-sm leading-relaxed">
          Free to start. No credit card required.
        </p>

        <form onSubmit={onSubmit} className="mt-9 space-y-4">
          <AuthField
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Ada Lovelace"
            icon={User}
          />

          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            placeholder="you@example.com"
            icon={Mail}
          />

          <AuthField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="At least 8 characters"
            minLength={8}
            icon={Lock}
          />

          {notice && (
            <div className="text-xs text-[var(--accent-strong)] bg-[var(--accent)]/10 rounded-2xl px-4 py-4 leading-snug">
              {notice}
            </div>
          )}

          <AuthErrorBanner>{err}</AuthErrorBanner>

          <div className="pt-1">
            <AuthPrimaryButton type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account <ArrowRight size={15} />
                </>
              )}
            </AuthPrimaryButton>
          </div>
        </form>

        <div className="text-sm text-[var(--ink-muted)] text-center mt-8">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[var(--accent-strong)] font-semibold hover:underline"
          >
            Sign in
          </Link>
        </div>

        <p className="text-xs text-[var(--ink-muted)]/80 text-center mt-6 leading-relaxed">
          By creating an account you agree to our terms.
          <br />
          We never share your billing data with third parties.
        </p>
      </motion.div>

      <OtpModal
        open={showOtp}
        email={form.email}
        onClose={() => setShowOtp(false)}
        onVerify={onVerified}
        onResend={onResend}
      />
    </AuthShell>
  );
}
