import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Hash,
  Loader2,
  Plus,
  ReceiptText,
  ScanLine,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { formatDate, formatMoney } from "../../../../lib/utils";
import { useExpensesMutations } from "../../../../hooks/useExpenses";
import useSmoothScroll from "../../../../hooks/useSmoothScroll";
import { Card, CardTitle } from "../../../ui/Card";
import ReceiptScanButton from "./ScanReceipt";
import { useReceiptScan } from "./useReceiptScan";

const ERROR_VISIBLE_MS = 5000;
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const MODAL_COPY = {
  category: {
    title: "Expense Categories",
    description:
      "Manage the buckets expense lines are filed under. New categories show up in the form instantly.",
    maxWidth: "max-w-[660px]",
  },
  scan_receipt: {
    title: "Scan Receipt",
    description:
      "Attach the receipt image — we'll read the vendor, items and totals and pre-fill the expense lines for you.",
    maxWidth: "max-w-[880px]",
  },
};

const blankReceipt = () => ({
  imageUrl: "",
  fileName: "",
  description: "",
  qty: "1",
  rate: "",
  items: [],
  vendor: "",
  receiptDate: "",
  currency: "",
  total: 0,
  suggestedCategory: "",
});

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
  const tableRef = useSmoothScroll();

  const [newCategory, setNewCategory] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(blankReceipt);

  const busy = adding || deletingId !== null || saving;

  // Live sum of the editable line items shown in the scan panel.
  const itemsTotal = (receipt.items ?? []).reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
    0,
  );

  const copy = MODAL_COPY[transaction] ?? MODAL_COPY.category;

  useEffect(() => {
    if (!err) return undefined;

    const id = setTimeout(() => setErr(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [err]);

  // Scan wiring lives above the open/transaction reset below — that reset
  // runs during render and clears the hook's error state, so the hook must
  // be declared first (calling setScanErr before initialization would throw
  // a ReferenceError the moment the modal opens).
  // Fill the form + "Scan list items" card from the AI result. Prefer the
  // itemized lines; fall back to vendor + grand total when Gemini couldn't
  // split items.
  const handleParsed = useCallback((parsed) => {
    const items = parsed.lineItems?.length
      ? parsed.lineItems.map((li) => ({
          description: li.description || parsed.vendor || "Item",
          quantity: Number(li.quantity) || 1,
          rate: Number(li.rate) || 0,
        }))
      : [
          {
            description: parsed.vendor || "Expense",
            quantity: 1,
            rate: Number(parsed.total) || 0,
          },
        ];

    setReceipt((r) => ({
      ...r,
      description: items[0].description,
      qty: String(items[0].quantity),
      rate: String(items[0].rate),
      items,
      vendor: parsed.vendor || "",
      receiptDate: parsed.receipt_date || "",
      currency: parsed.currency || "",
      total: parsed.total || 0,
      suggestedCategory: parsed.suggested_category || "",
    }));
    toast.success("Receipt scanned — check the details below.");
  }, []);

  const handleScanError = useCallback((message) => {
    toast.error(message);
  }, []);

  const {
    loading: scanning,
    err: scanErr,
    setErr: setScanErr,
    scanFile,
  } = useReceiptScan({ onParsed: handleParsed, onError: handleScanError });

  const [prev, setPrev] = useState({ open, transaction });
  if (prev.open !== open || prev.transaction !== transaction) {
    setPrev({ open, transaction });
    setNewCategory("");
    setErr("");
    setScanErr("");
    setAdding(false);
    setDeletingId(null);
    setSaving(false);
    setReceipt(blankReceipt());
  }

  const handleClose = () => {
    if (busy || scanning) return;
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

  // Single entry point for every upload path (dropzone drop, dropzone
  // click-pick, manual scan icon): shows the preview immediately, then
  // auto-scans the same file so the "Scan list items" card fills itself.
  const handleFilePicked = useCallback(
    (file) => {
      setErr("");
      setScanErr("");
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

      scanFile(file);
    },
    [scanFile, setScanErr],
  );

  const onDrop = useCallback(
    (accepted) => {
      const file = accepted[0];
      if (file) handleFilePicked(file);
    },
    [handleFilePicked],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    // A scan is already running — ignore further drops/picks until it ends.
    disabled: scanning,
    // Same set the scan engine validates against (PNG/JPG/WEBP + PDF).
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
  });

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

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      // Scanning locks the whole dialog — no Escape close mid-scan.
      if (e.key === "Escape" && (busy || scanning)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        setErr("");
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, busy, scanning, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm flex items-center justify-center px-2">
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
                  <div className="flex items-center gap-2.5">
                    <h3
                      id="expenses-modal-title"
                      className="text-lg font-semibold tracking-tight"
                    >
                      {copy.title}
                    </h3>
                    {transaction === "scan_receipt" && scanning && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                        <Loader2 size={11} className="animate-spin" />
                        Scanning…
                      </span>
                    )}
                  </div>
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

              {/* Scan-in-progress overlay: covers the whole panel, swallows
                  every interaction so nothing can be touched mid-scan. */}
              {transaction === "scan_receipt" && scanning && (
                <div
                  aria-live="polite"
                  aria-busy="true"
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-3xl bg-[var(--surface)]/80 backdrop-blur-[3px]"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-soft)]" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <ScanLine size={28} className="animate-pulse" />
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      Scanning receipt, please wait
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                      Reading vendor, items and totals — this takes a few
                      seconds.
                    </p>
                  </div>
                </div>
              )}

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
                    {receipt.imageUrl ? (
                      <div className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-4">
                          <img
                            src={receipt.imageUrl}
                            alt="Receipt preview"
                            className="h-20 w-16 shrink-0 rounded-xl border border-[var(--border)] bg-white object-cover shadow-card"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">
                              {receipt.fileName || "Receipt attached"}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                              {scanning
                                ? "Reading the receipt…"
                                : "Click or drop to replace"}
                            </p>
                            {scanning && (
                              <div className="mt-2.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--surface-2)]">
                                <div className="h-full w-1/3 animate-[scanbar_1.2s_ease-in-out_infinite] rounded-full bg-[var(--accent)]" />
                              </div>
                            )}
                          </div>
                          {!scanning && (
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
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div
                          {...getRootProps()}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 transition-colors ${
                            isDragActive
                              ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]/40"
                              : "border-[var(--border)] bg-[var(--surface-2)]/40 hover:border-[var(--accent)]/40"
                          }`}
                        >
                          <input {...getInputProps()} />
                          <ReceiptScanButton
                            scanning={scanning}
                            onFile={handleFilePicked}
                          />
                          {scanErr && (
                            <p
                              role="alert"
                              className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--danger)]"
                            >
                              {scanErr}
                            </p>
                          )}
                        </div>
                      )}

                    <div className="grid gap-4 lg:grid-cols-[340px_1fr] items-start">
                      {/* Left: parsed details / live totals */}
                      <Card padding="lg">
                        <CardTitle>Details</CardTitle>
                        <div className="mt-4 space-y-3">
                          {[
                            ["Vendor", receipt.vendor],
                            ["Date", receipt.receiptDate],
                            ["Currency", receipt.currency],
                          ]
                            .filter(([, v]) => v)
                            .map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span className="type-eyebrow text-[var(--ink-muted)]">
                                  {label}
                                </span>
                                <span className="truncate text-sm font-semibold tabular text-[var(--ink)]">
                                  {value}
                                </span>
                              </div>
                            ))}

                          {/* Skeleton while the scan is extracting */}
                          {scanning && !receipt.vendor && !receipt.receiptDate && (
                            <div className="space-y-3 pt-1">
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <div className="h-2.5 w-14 animate-pulse rounded-full bg-[var(--surface-2)]" />
                                  <div className="h-2.5 w-24 animate-pulse rounded-full bg-[var(--surface-2)]" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                          <span className="type-eyebrow text-[var(--ink-muted)]">
                            Total amount
                          </span>
                          <span className="font-display text-lg font-semibold tabular text-[var(--ink)]">
                            {formatMoney(itemsTotal)}
                          </span>
                        </div>
                      </Card>

                      {/* Right: editable line items */}
                      <Card padding="lg">
                        <CardTitle>Scan list items</CardTitle>
                        <div className="mt-5 hidden sm:grid grid-cols-[1fr_64px_100px_100px_32px] gap-3 px-1 pb-2 text-[11px] uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
                          <span>Description</span>
                          <span className="text-center">Qty</span>
                          <span className="text-center">Rate</span>
                          <span className="text-right">Amount</span>
                          <span></span>
                        </div>

                        <div className="space-y-2">
                          {scanning && !(receipt.items ?? []).length && (
                            <div className="space-y-2">
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-[1fr_64px_100px] items-center gap-3"
                                >
                                  <div className="h-9 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                                  <div className="h-9 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                                  <div className="h-9 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                                </div>
                              ))}
                            </div>
                          )}

                          {(receipt.items ?? []).map((item, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-2 sm:grid-cols-[1fr_80px_110px_110px_32px] gap-3 items-center"
                          >
                            <Input
                              className="col-span-2 sm:col-span-1 rounded-xl"
                              value={item.description}
                              placeholder="Description"
                              onChange={(e) =>
                                setReceipt((r) => {
                                  const items = [...r.items];
                                  items[i] = {
                                    ...items[i],
                                    description: e.target.value,
                                  };
                                  return { ...r, items };
                                })
                              }
                            />
                            <Input
                              className="rounded-xl text-right tabular"
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) =>
                                setReceipt((r) => {
                                  const items = [...r.items];
                                  items[i] = {
                                    ...items[i],
                                    quantity: e.target.value,
                                  };
                                  return { ...r, items };
                                })
                              }
                            />
                            <Input
                              className="rounded-xl text-right tabular"
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={(e) =>
                                setReceipt((r) => {
                                  const items = [...r.items];
                                  items[i] = { ...items[i], rate: e.target.value };
                                  return { ...r, items };
                                })
                              }
                            />
                            <div className="text-right text-sm font-semibold tabular text-[var(--ink)] pr-1">
                              {formatMoney(
                                (Number(item.quantity) || 0) *
                                  (Number(item.rate) || 0),
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setReceipt((r) => ({
                                  ...r,
                                  items: r.items.filter((_, j) => j !== i),
                                }))
                              }
                              className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] justify-self-end"
                              title="Remove line"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                          {!scanning && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceipt((r) => ({
                                  ...r,
                                  items: [
                                    ...(r.items ?? []),
                                    { description: "", quantity: 1, rate: "" },
                                  ],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent-strong)] hover:underline"
                            >
                              <Plus size={13} /> Add line
                            </button>
                          )}

                          {(receipt.items ?? []).length === 0 && !scanning && (
                            <p className="text-[12px] text-[var(--ink-muted)]">
                              Attach a receipt and the extracted lines will
                              appear here for review.
                            </p>
                          )}
                        </div>
                      </Card>
                    </div>

                    {receipt.suggestedCategory && (
                      <div className="flex items-center gap-2 rounded-2xl bg-[var(--accent-soft)]/60 px-4 py-3 text-[12px] font-semibold text-[var(--accent-strong)]">
                        <Sparkles size={14} />
                        Suggested category: {receipt.suggestedCategory}
                      </div>
                    )}
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
                {/* Scanning locks the dialog: Cancel and Confirm are both
                    disabled until the scan finishes or fails. */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={busy || scanning}
                >
                  {transaction === "scan_receipt" ? "Cancel" : "Close"}
                </Button>
                {transaction === "scan_receipt" && (
                  <Button
                    type="submit"
                    form="receipt-form"
                    variant="accent"
                    disabled={saving || scanning}
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ReceiptText size={14} />
                    )}
                    Confirm Receipt
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
