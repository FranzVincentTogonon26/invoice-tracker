import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "../../../ui/Button";
import { LockBodyScroll } from "../../../../hooks/useLockBody";

// "Remove scanned receipt?" confirm dialog shown before discarding a
// receipt that already has data attached.
const ConfirmClearDialog = ({ open, onKeep, onConfirm }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        onClick={onKeep}
      >
        <LockBodyScroll />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          role="alertdialog"
          aria-modal="true"
          aria-label="Remove scanned receipt"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[380px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--danger)]/10 text-[var(--danger)]">
              <Trash2 size={17} />
            </span>
            <div className="min-w-0">
              <h4 className="text-lg font-semibold text-[var(--ink)]">
                Remove scanned receipt?
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                This clears the attached image, receipt details, scan list items
                and total. You can scan again afterwards.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onKeep}>
              Keep
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm}>
              <Trash2 size={13} /> Confirm remove
            </Button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ConfirmClearDialog;
