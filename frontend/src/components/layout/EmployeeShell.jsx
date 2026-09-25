import { AnimatePresence, motion } from "framer-motion";
import { Topbar } from "./employee/Topbar";
import { Sidebar } from "./employee/Sidebar";
import { Outlet, useLocation } from "react-router-dom";

export default function EmployeeShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar />
      <main className="flex-1 px-3 md:px-8 pt-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-6 max-w-[1600px] mx-auto w-full">
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
