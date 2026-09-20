import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

// Shared animated alert box — every error in the modal surfaces here.
const ErrorAlert = ({ message }) => (
  <AnimatePresence initial={false}>
    {message && (
      <motion.div
        initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto", marginTop: 16 }}
        exit={{
          opacity: 0,
          y: -4,
          height: 0,
          marginTop: 0,
          transition: { duration: 0.25, ease: "easeOut" },
        }}
        role="alert"
        className="flex items-start gap-2 overflow-hidden text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-4"
      >
        <AlertCircle size={14} className="mt-px shrink-0" />
        {message}
      </motion.div>
    )}
  </AnimatePresence>
);

export default ErrorAlert;
