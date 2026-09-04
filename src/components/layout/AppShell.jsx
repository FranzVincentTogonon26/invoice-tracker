import { AnimatePresence, motion } from "framer-motion";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar />

      <main className="flex-1 px-6 md:px-8 py-6 max-w-[1600px] mx-auto w-full">
        <Topbar />

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
