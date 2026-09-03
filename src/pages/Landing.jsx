import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import InvoiceWall from "../components/landing/invoice-wall";

export default function Landing() {
  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", "light");
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0c1a17] overflow-x-clip antialiased">
      {/* Nav Section */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-black/[0.05]">
        <div className="max-w-[1400px] mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-semibold text-lg leading-1 tracking-widest">
              Invoice Tracker
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="h-10 px-4 rounded-full text-sm font-semibold hover:bg-black/[0.04] flex items-center transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="group h-10 px-5 rounded-full text-sm font-semibold text-white flex items-center gap-1.5 shadow-[0_8px_24px_-8px_rgba(13,148,136,0.6)] hover:shadow-[0_12px_30px_-8px_rgba(13,148,136,0.75)] transition-all"
              style={{
                background:
                  "linear-gradient(135deg,#14b8a6,#0d9488 50%,#0f766e)",
              }}
            >
              Get started{" "}
              <ArrowRight
                size={15}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* ambient glows */}
        <div
          className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(45,212,191,0.22), transparent 70%)",
          }}
        />
        <div
          className="absolute top-20 right-0 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.16), transparent 70%)",
          }}
        />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.35fr] gap-10 items-center pt-16 lg:pt-24 pb-16">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-black/[0.05] text-[#0f766e] text-xs font-semibold shadow-sm">
              <Sparkles size={13} /> AI-powered invoicing
            </span>
            <h1 className="font-display text-[clamp(40px,6.4vw,68px)] font-semibold leading-[0.98] tracking-tight mt-6">
              Invoicing that
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(120deg,#0f766e,#14b8a6 55%,#2dd4bf)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                runs itself.
              </span>
            </h1>
            <p className="text-lg text-[#4a5f5a] mt-6 max-w-lg leading-relaxed">
              Create beautiful invoices, track payments, and let AI read
              receipts, draft reminders, and summarize your revenue — so you get
              back to the work that pays.
            </p>
            <div className="flex items-center gap-3 mt-8">
              <Link
                to="/register"
                className="group h-12 px-7 rounded-full text-sm font-semibold text-white flex items-center gap-2 shadow-[0_12px_30px_-8px_rgba(13,148,136,0.65)] hover:shadow-[0_16px_38px_-8px_rgba(13,148,136,0.8)] transition-all"
                style={{
                  background:
                    "linear-gradient(135deg,#14b8a6,#0d9488 50%,#0f766e)",
                }}
              >
                Start free{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
              <Link
                to="/login"
                className="h-12 px-6 rounded-full text-sm font-semibold border border-black/10 bg-white hover:bg-black/[0.03] flex items-center transition-colors"
              >
                Sign in
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8">
              {[
                "Client CRM",
                "PDF export",
                "Payments & expenses",
                "Multi-currency",
              ].map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4a5f5a]"
                >
                  <Check size={14} className="text-[#0d9488]" /> {f}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — scrolling invoice wall */}
          <div className="hidden lg:block">
            <InvoiceWall />
          </div>
        </div>
      </section>
    </div>
  );
}
