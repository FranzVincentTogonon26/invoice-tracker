import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

// Shared animated alert box — every error in the modal surfaces here.
//
// The modal renders this in a pinned `shrink-0` row ABOVE its scrollable
// body, so the alert is always in normal flow and visible on mobile the
// moment `message` is truthy — no scroll-chasing needed. For that reason this
// animates y/opacity ONLY: no height/margin animation (mobile text wrap makes
// "auto" targets unreliable) and no popLayout mode (it would lift the alert
// out of the pinned row on small viewports). The static `mb-4` keeps the
// rhythm with the panels below and only exists while the alert does.
const ErrorAlert = ({ message }) => (
  <AnimatePresence initial={false}>
    {message && (
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: -8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: "easeOut" },
        }}
        exit={{
          opacity: 0,
          y: -8,
          transition: { duration: 0.2, ease: "easeIn" },
        }}
        className="flex items-start gap-2 overflow-hidden text-sm text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mb-4"
      >
        <AlertCircle size={14} className="mt-px shrink-0" />
        {message}
      </motion.div>
    )}
  </AnimatePresence>
);

export default ErrorAlert;
