import { useEffect } from "react";

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
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-black/[0.05]">
        <div className="max-w-[1400px] mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AILogo />
            <span className="font-display font-semibold text-lg">Invoicer</span>
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
    </div>
  );
}
