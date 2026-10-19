import { motion } from "framer-motion";
import {
  AuthShell,
  AuthErrorBanner,
  AuthField,
  AuthPrimaryButton,
} from "@/components/auth/AuthShell";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(form);
      // RootRedirect sends the user to the correct dashboard for their role.
      nav("/");
    } catch (error) {
      setErr(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      brandLockup
      headline={
        <>
          Every peso,
          <br />
          <em style={{ fontStyle: "italic" }}>accounted for.</em>
        </>
      }
      subhead="Source of funds, staff budgets, abono, and receipts read by AI — every movement in one live ledger."
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-display text-3xl font-medium tracking-tight text-[var(--ink)] leading-[1.05]">
          Welcome back
        </h1>
        <p className="text-[var(--ink-muted)] mt-2 text-sm leading-relaxed">
          Sign in to track budgets, expenses, and staff liquidations.
        </p>

        <form onSubmit={onSubmit} className="mt-9 space-y-4">
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
            autoComplete="current-password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="••••••••"
            icon={Lock}
            extra={
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs font-medium tracking-tight text-[var(--accent-strong)] hover:underline"
              >
                Forgot password?
              </button>
            }
          />

          <AuthErrorBanner>{err}</AuthErrorBanner>

          <div className="pt-1">
            <AuthPrimaryButton type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </AuthPrimaryButton>
          </div>
        </form>

        <div className="text-sm text-[var(--ink-muted)] text-center mt-8">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-[var(--accent-strong)] font-medium hover:underline"
          >
            Create one
          </Link>
        </div>
      </motion.div>

      <ForgotPasswordModal
        open={showForgot}
        onClose={() => setShowForgot(false)}
        // After a successful reset, prefill the sign-in email so the user
        // only has to type the new password.
        onDone={(email) => setForm((f) => ({ ...f, email }))}
      />
    </AuthShell>
  );
}
