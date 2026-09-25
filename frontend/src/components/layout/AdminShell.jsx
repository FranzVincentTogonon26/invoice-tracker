import { motion } from "framer-motion";
import { Topbar } from "./admin/Topbar";
import { Sidebar } from "./admin/Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "../ui/CommandPalette";

export default function AppShell() {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Close the palette when the route changes (adjust state during render —
  // the documented alternative to a setState-in-effect).
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setPaletteOpen(false);
  }

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e) {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar />

      {/* `pb-*` clears the fixed mobile dock (Sidebar) plus the device's home
          indicator; from `md` up the rail is back in flow, so only the normal
          padding applies. */}
      <main className="flex-1 px-3 md:px-8 pt-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-6 max-w-[1600px] mx-auto w-full">
        <Topbar onOpenPalette={openPalette} />

        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{
            duration: 0.25,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Outlet />
        </motion.div>
      </main>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
