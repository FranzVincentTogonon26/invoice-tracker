import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

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
