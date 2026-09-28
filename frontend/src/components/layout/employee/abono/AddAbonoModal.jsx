import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Banknote, HandCoins, Loader2, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { Input, TextArea } from "../../../ui/Input";
import { useAbonoMutations } from "../../../../hooks/useAbono";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// "Add Abono" dialog — a description (textarea) and the amount paid
// out-of-pocket. The source of funds is resolved server-side against the
// employee's open budget issuances, so the form stays these two fields.
// Portalled to `document.body` like the rest of the app's dialogs (the page
// sits inside an animated framer-motion card whose transform would otherwise
// trap this `fixed` overlay).
const AddAbonoModal = ({ open, onClose }) => {
  const titleId = useId();
  const descriptionRef = useRef(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState({});
  const { create } = useAbonoMutations();
  const pending = create.isPending;

  const close = useCallback(() => {
    if (pending) return;
    onClose?.();
  }, [pending, onClose]);

  // Land focus in the description each time the dialog opens. The fields are
  // reset from AnimatePresence's onExitComplete below instead of from this
  // effect — resetting synchronously in an effect trips
  // react-hooks/set-state-in-effect and would blank the fields mid-exit.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => descriptionRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  const validate = () => {
    const next = {};
    if (description.trim().length < 2) {
      next.description =
        "Describe the out-of-pocket spend (at least 2 characters).";
    }
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed)) {
      next.amount = "Amount is required.";
    } else if (parsed <= 0) {
      next.amount = "Amount must be greater than zero.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending || !validate()) return;

    try {
      await create.mutateAsync({
        description: description.trim(),
        amount: Number(amount),
      });
      toast.success("Abono added");
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Couldn't add abono");
    }
  };

  return createPortal(
    <AnimatePresence
      // Fires once the closed dialog has finished fading out — the fields
      // reset here, so the next open always starts blank without an effect.
      onExitComplete={() => {
        setDescription("");
        setAmount("");
        setErrors({});
      }}
    >
      {open && (
        <motion.div
          key="add-abono"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: DIALOG_EASE }}
        >
          {/* Backdrop click = dismiss (a no-op while the save is in flight). */}
          <div
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            <form onSubmit={handleSubmit} noValidate>
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--warning)]/15 text-[var(--warning)]">
                    <HandCoins size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3
                      id={titleId}
                      className="font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                    >
                      Add Abono
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                      Record an out-of-pocket expense you paid for.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  aria-label="Close add abono"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="space-y-4 px-5 py-4">
                <div>
                  <label
                    htmlFor="abono-amount"
                    className="type-eyebrow block text-[var(--ink-muted)]"
                  >
                    Amount
                  </label>
                  <div className="mt-1.5">
                    <Input
                      id="abono-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      Icon={Banknote}
                      disabled={pending}
                      aria-invalid={Boolean(errors.amount)}
                    />
                  </div>
                  {errors.amount && (
                    <p
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-[var(--danger)]"
                    >
                      {errors.amount}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="abono-description"
                    className="type-eyebrow block text-[var(--ink-muted)]"
                  >
                    Description
                  </label>
                  <div className="mt-1.5">
                    <TextArea
                      id="abono-description"
                      ref={descriptionRef}
                      rows={4}
                      placeholder="e.g. Taxi fare to the client meeting"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={pending}
                      aria-invalid={Boolean(errors.description)}
                    />
                  </div>
                  {errors.description && (
                    <p
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-[var(--danger)]"
                    >
                      {errors.description}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={pending}>
                  {pending && (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  )}
                  {pending ? "Saving…" : "Add Abono"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default AddAbonoModal;