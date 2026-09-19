import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Hash,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Input, TextArea } from "../../../ui/Input";
import { formatDate, formatMoney } from "../../../../lib/utils";
import { useExpensesMutations } from "../../../../hooks/useExpenses";
import useSmoothScroll from "../../../../hooks/useSmoothScroll";

// Error banners auto-dismiss after this long (ms); AnimatePresence plays the
// smooth fade/slide/height-collapse exit when the message clears.
const ERROR_VISIBLE_MS = 5000;

// Receipts travel to the API as a base64 data URL (there is no file storage
// behind the `receipt` table yet), so the raw file is capped here.
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

// Copy per modal kind — the shell, chrome and a11y wiring are shared; only the
// panel and labels swap. Adding a third transaction = one config entry.
const MODAL_COPY = {
  category: {
    title: "Expense Categories",
    description:
      "Manage the buckets expense lines are filed under. New categories show up in the form instantly.",
    maxWidth: "max-w-[600px]",
  },
  scan_receipt: {
    title: "Scan Receipt",
    description:
      "Attach the receipt image, describe the purchase and we'll pre-fill an expense line for you.",
    maxWidth: "max-w-[640px]",
  },
};

const blankReceipt = () => ({
  imageUrl: "",
  fileName: "",
  description: "",
  qty: "1",
  rate: "",
});

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[11px] leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * One reusable dialog for the Expenses page.
 *
 * `transaction` selects the panel:
 *   "category"     → add / list / delete categories
 *   "scan_receipt" → upload a receipt, then create the `receipt` row
 *
 * Data flows out through callbacks so the parent stays the single source of
 * truth: `onAdd(category)`, `onDelete(categoryId)`, `onReceiptCreated(receipt)`.
 */
const ExpensesModal = ({
  open,
  onClose,
  transaction = "category",
  categories = [],
  onAdd,
  onDelete,
  onReceiptCreated,
}) => {
  const { create, removeCategory } = useExpensesMutations();
  // Smooth eased wheel scrolling for the category table.
  const tableRef = useSmoothScroll();

  const [newCategory, setNewCategory] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(blankReceipt);

  const busy = adding || deletingId !== null || saving;
  const copy = MODAL_COPY[transaction] ?? MODAL_COPY.category;

  // Auto-dismiss: clear the error after ERROR_VISIBLE_MS so stale messages
  // don't linger. Restarted every time a new error appears; clearing triggers
  // the smooth exit animation below via AnimatePresence.
  useEffect(() => {
    if (!err) return undefined;

    const id = setTimeout(() => setErr(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [err]);

  // Reset the panel each time the modal opens or switches transaction.
  const [prev, setPrev] = useState({ open, transaction });
  if (prev.open !== open || prev.transaction !== transaction) {
    setPrev({ open, transaction });
    setNewCategory("");
    setErr("");
    setAdding(false);
    setDeletingId(null);
    setSaving(false);
    setReceipt(blankReceipt());
  }

  const handleClose = () => {
    if (busy) return;
    setErr("");
    onClose?.();
  };

  /* ── category panel actions ──────────────────────────────────── */

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setErr("");

    const category_name = newCategory.trim();
    if (!category_name) {
      setErr("Category name is required.");
      return;
    }

    setAdding(true);
    try {
      const created = await create.mutateAsync({
        type: "category",
        category_name,
      });
      await onAdd?.(created);

      // Stay open — adding several categories in a row is the common case.
      setNewCategory("");
      toast.success(
        `Category "${created.category_name ?? category_name}" added!`,
      );
    } catch (error) {
      setErr(error?.message || "Couldn't add category");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (busy) return;
    setErr("");
    setDeletingId(categoryId);
    try {
      await removeCategory.mutateAsync(categoryId);
      onDelete?.(categoryId);
      toast.success("Category removed!");
    } catch (error) {
      setErr(error?.message || "Couldn't remove category");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── scan_receipt panel actions ──────────────────────────────── */

  // Read the picked image into a data URL so it survives the POST and can be
  // re-opened from the expense line later.
  const onDrop = useCallback((accepted) => {
    setErr("");
    const file = accepted[0];
    if (!file) return;

    if (file.size > MAX_RECEIPT_BYTES) {
      setErr("Receipt must be 2MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      setReceipt((r) => ({
        ...r,
        imageUrl: String(reader.result ?? ""),
        fileName: file.name,
      }));
    reader.onerror = () => setErr("Couldn't read that file.");
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
  });

  // `qty`/`rate` are the only money inputs — the total is derived, so the row
  // can never disagree with itself.
  const qty = Number(receipt.qty) || 0;
  const rate = Number(receipt.rate) || 0;
  const amount = Number((qty * rate).toFixed(2));

  const handleConfirmReceipt = async (e) => {
    e.preventDefault();
    setErr("");

    const description = receipt.description.trim();
    if (description.length < 2) {
      setErr("Receipt description is required.");
      return;
    }
    if (qty <= 0) {
      setErr("Quantity must be at least 1.");
      return;
    }
    if (rate <= 0) {
      setErr("Rate must be greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const created = await create.mutateAsync({
        type: "receipt",
        description,
        qty,
        rate,
        amount,
        image_url: receipt.imageUrl || undefined,
      });

      onReceiptCreated?.(created);
      toast.success("Receipt scanned!");
      setReceipt(blankReceipt());
      onClose?.();
    } catch (error) {
      setErr(error?.message || "Couldn't save the receipt");
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape while open (never while busy) — stopPropagation keeps any
  // window-level handler behind the modal from also firing.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        setErr("");
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, busy, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div
            onClick={handleClose}
            className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm flex items-center justify-center px-2"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="expenses-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex w-full ${copy.maxWidth} flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7`}
            >
              <div className="flex shrink-0 items-start justify-between mb-5">
                <div className="min-w-0">
                  <h3
                    id="expenses-modal-title"
                    className="text-lg font-semibold tracking-tight"
                  >
                    {copy.title}
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-[var(--ink-muted)]">
                    {copy.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close dialog"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body — header and footer stay pinned; only this
                  area scrolls when the panel grows past the viewport */}
              <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
                {transaction === "category" && (
                  <>
                    <form
                      onSubmit={handleAddCategory}
                      className="flex shrink-0 items-center gap-2"
                    >
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category name…"
                        Icon={Hash}
                        disabled={adding}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        variant="soft"
                        size="icon"
                        disabled={adding}
                        aria-label="Add new category"
                      >
                        {adding ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}
                      </Button>
                    </form>
                    <div
                      ref={tableRef}
                      className="scrollbar-slim mt-5 max-h-[50vh] min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)]"
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="sticky top-0 z-10 bg-[var(--surface-2)] type-eyebrow text-[var(--ink-muted)]">
                            <th className="px-4 py-2.5 text-left font-semibold">
                              Category
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold">
                              Date Created
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold" />
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((category) => (
                            <tr
                              key={category.category_id}
                              className="border-t border-[var(--border)] first:border-t-0 hover:bg-[var(--surface-2)]/60 transition-colors"
                            >
                              <td
                                title={category.category_name}
                                className="max-w-[240px] truncate px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                              >
                                {category.category_name ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-[var(--ink-muted)] whitespace-nowrap">
                                {formatDate(category.created_at)}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteCategory(category.category_id)
                                  }
                                  disabled={adding || deletingId !== null}
                                  aria-label={`Delete category ${category.category_name}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                  {deletingId === category.category_id ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {categories.length === 0 && (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]"
                              >
                                No categories yet — add one above.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {transaction === "scan_receipt" && (
                  <form
                    id="receipt-form"
                    onSubmit={handleConfirmReceipt}
                    className="space-y-4"
                  >
                    {/* Dropzone — click or drag. Shows the picked image as a
                        preview so the user can confirm it's the right shot. */}
                    <div
                      {...getRootProps()}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 transition-colors ${
                        isDragActive
                          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]/40"
                          : "border-[var(--border)] bg-[var(--surface-2)]/40 hover:border-[var(--accent)]/40"
                      }`}
                    >
                      <input {...getInputProps()} />

                      {receipt.imageUrl ? (
                        <>
                          <img
                            src={receipt.imageUrl}
                            alt="Receipt preview"
                            className="h-14 w-14 shrink-0 rounded-xl border border-[var(--border)] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--ink)]">
                              {receipt.fileName || "Receipt attached"}
                            </p>
                            <p className="text-[11px] text-[var(--ink-muted)]">
                              Click or drop to replace
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReceipt((r) => ({
                                ...r,
                                imageUrl: "",
                                fileName: "",
                              }));
                            }}
                            aria-label="Remove attached receipt"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                            <Upload size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--ink)]">
                              Drop the receipt here
                            </p>
                            <p className="text-[11px] text-[var(--ink-muted)]">
                              PNG, JPG or WEBP · up to 2MB
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <Field
                      label="Receipt description"
                      hint="Becomes the expense line description when you save."
                    >
                      <TextArea
                        value={receipt.description}
                        onChange={(e) =>
                          setReceipt((r) => ({
                            ...r,
                            description: e.target.value,
                          }))
                        }
                        placeholder="e.g. Office supplies — National Book Store"
                        disabled={saving}
                        rows={2}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantity">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={receipt.qty}
                          onChange={(e) =>
                            setReceipt((r) => ({ ...r, qty: e.target.value }))
                          }
                          disabled={saving}
                          className="tabular text-right"
                        />
                      </Field>
                      <Field label="Unit rate">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={receipt.rate}
                          onChange={(e) =>
                            setReceipt((r) => ({ ...r, rate: e.target.value }))
                          }
                          placeholder="0.00"
                          disabled={saving}
                          className="tabular text-right"
                        />
                      </Field>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)]/70 px-4 py-3">
                      <span className="type-eyebrow text-[var(--ink-muted)]">
                        Total amount
                      </span>
                      <span className="font-display text-lg font-semibold tabular text-[var(--ink)]">
                        {formatMoney(amount)}
                      </span>
                    </div>
                  </form>
                )}

                <AnimatePresence initial={false}>
                  {err && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        height: "auto",
                        marginTop: 16,
                      }}
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
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 mt-5 pt-5 border-t border-[var(--border)]">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {transaction === "scan_receipt" ? "Cancel" : "Close"}
                </Button>
                {transaction === "scan_receipt" && (
                  <Button
                    type="submit"
                    form="receipt-form"
                    variant="accent"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ScanLine size={14} />
                    )}
                    Confirm
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpensesModal;
