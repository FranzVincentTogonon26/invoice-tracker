import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../ui/Button";
import { useExpensesMutations } from "../../../hooks/useExpenses";
import useSmoothScroll from "../../../hooks/useSmoothScroll";
import { useReceiptScan } from "../../../hooks/useReceiptScan";
import {
  buildReceiptDraft,
  savePendingReceipt,
} from "../../../lib/receiptDraft";
import { registerReceiptFile } from "../../../lib/receiptFiles";
import {
  ERROR_VISIBLE_MS,
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_LABEL,
  MODAL_COPY,
  blankReceipt,
} from "../../../constants";
import CategoryPanel from "./CategoryPanel";
import ScanOverlay from "./ScanOverlay";
import ErrorAlert from "./ErrorAlert";
import ConfirmClearDialog from "./ConfirmClearDialog";
import ReceiptPanel from "./ReceiptPanel";

const ExpensesModal = ({
  open,
  onClose,
  transaction = "category",
  categories = [],
  onAdd,
  onDelete,
  onReceiptCreated,
  onReceiptConfirmed,
  isBackdatedDate,
}) => {
  const { create, removeCategory } = useExpensesMutations();
  const tableRef = useSmoothScroll();
  const [newCategory, setNewCategory] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(blankReceipt);
  const [confirmClear, setConfirmClear] = useState(false);
  const busy = adding || deletingId !== null || saving;

  // Object URL for the picked receipt file. The file is only held in the
  // browser until "Save expenses" (deferred batch upload), so this URL is the
  // only thing that keeps the preview alive — it is revoked whenever the
  // receipt is replaced, cleared, or the modal unmounts.
  const previewUrlRef = useRef("");
  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const hasReceiptData =
    Boolean(receipt.localPreviewUrl) ||
    Boolean(receipt.imageUrl) ||
    Boolean(receipt.fileName) ||
    Boolean(receipt.vendor) ||
    Boolean(receipt.receiptDate) ||
    Boolean(receipt.currency) ||
    Number(receipt.total) > 0 ||
    (receipt.items ?? []).length > 0;

  // A picked-but-not-yet-uploaded file — what enables "Confirm Receipt". The
  // scan stores nothing server-side, so the local pick (not a URL) is the
  // signal that a receipt is attached.
  const hasReceiptImage = Boolean(receipt.localPreviewUrl);

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
      fileName: r.fileName || parsed.fileName,
    }));

    toast.success("Receipt scanned � check the details below.");
  }, []);

  const handleScanError = useCallback((message) => {
    setErr(message);
  }, []);

  const {
    loading: scanning,
    err: scanErr,
    setErr: setScanErr,
    scanFile,
  } = useReceiptScan({ onParsed: handleParsed, onError: handleScanError });

  // Full receipt reset (scan state + errors + the local preview URL).
  const clearReceipt = useCallback(() => {
    releasePreview();
    setScanErr("");
    setErr("");
    setReceipt(blankReceipt());
  }, [releasePreview]);

  const hasScannedContent = scanning || (hasReceiptData && !scanErr);
  const scanFailed = Boolean(scanErr);

  const [prev, setPrev] = useState({ open, transaction });

  if (prev.open !== open || prev.transaction !== transaction) {
    setPrev({ open, transaction });
    setNewCategory("");
    setErr("");
    setScanErr("");
    setAdding(false);
    setDeletingId(null);
    setSaving(false);
    releasePreview();
    setReceipt(blankReceipt());
    setConfirmClear(false);
  }

  const handleClose = () => {
    if (busy || scanning) return;
    setErr("");
    onClose?.();
  };

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

  const handleFilePicked = useCallback(
    (file) => {
      setErr("");
      setScanErr("");
      if (!file) return;

      if (file.size > MAX_RECEIPT_BYTES) {
        setErr(`Receipt must be ${MAX_RECEIPT_LABEL} or smaller.`);
        return;
      }

      // Hold the file locally — nothing reaches the server yet. The object URL
      // previews it and the File itself is what "Save expenses" ships to the
      // deferred batch upload once this receipt is confirmed.
      releasePreview();
      const localPreviewUrl = URL.createObjectURL(file);
      previewUrlRef.current = localPreviewUrl;
      setReceipt((r) => ({
        ...r,
        file,
        localPreviewUrl,
        fileName: file.name,
      }));
      scanFile(file);
    },
    [scanFile, setScanErr, releasePreview],
  );

  const handleItemChange = useCallback((index, patch) => {
    setReceipt((r) => {
      const items = [...r.items];
      items[index] = { ...items[index], ...patch };
      return { ...r, items };
    });
  }, []);

  const handleRemoveItem = useCallback((index) => {
    setReceipt((r) => ({
      ...r,
      items: r.items.filter((_, j) => j !== index),
    }));
  }, []);

  const handleAddItem = useCallback(() => {
    setReceipt((r) => ({
      ...r,
      items: [
        ...(r.items ?? []),
        {
          description: "",
          quantity: 1,
          rate: "",
        },
      ],
    }));
  }, []);

  const handleConfirmClear = useCallback(() => {
    clearReceipt();
    setConfirmClear(false);
    toast.success("Scanned receipt cleared.");
  }, [clearReceipt]);

  const handleRequestRemoveReceipt = useCallback(() => {
    if (hasReceiptData) {
      setConfirmClear(true);
    } else {
      clearReceipt();
    }
  }, [hasReceiptData, clearReceipt]);

  const handleConfirmReceipt = async (e) => {
    e.preventDefault();
    setErr("");

    if (onReceiptConfirmed) {
      const items = (receipt.items ?? []).filter(
        (item) =>
          String(item.description ?? "").trim() &&
          Number(item.quantity) > 0 &&
          Number(item.rate) > 0,
      );

      if (!items.length) {
        setErr(
          "Every scanned line needs a description, quantity and rate before confirming.",
        );
        return;
      }

      // Hand the live footer sum over as the stored total: it is the same
      // figure "Confirm Receipt" displays, so the draft's lines and its
      // total can never disagree (a stale scanned grand total would).
      const { draft, persisted, imageDropped } = savePendingReceipt(
        buildReceiptDraft({ ...receipt, items }, itemsTotal),
      );

      // Park the picked file under the draft id — the deferred batch upload
      // finds it from this key when "Save expenses" runs. The draft itself
      // only stores text, so the bytes never touch localStorage.
      if (receipt.file) registerReceiptFile(draft.receiptId, receipt.file);

      onReceiptConfirmed(draft);
      clearReceipt();
      onClose?.();

      if (isBackdatedDate?.(draft.date)) {
        toast(
          "Receipt confirmed, but its date is behind the first budget issued to you — the line is flagged.",
          {
            icon: <AlertTriangle size={16} className="text-[var(--warning)]" />,
          },
        );
        return;
      }

      toast.success(
        !persisted
          ? "Receipt confirmed grouped line added for this session only."
          : imageDropped
            ? "Receipt confirmed grouped line added (image couldn't be kept in this browser)."
            : "Receipt confirmed grouped line added.",
      );
      return;
    }

    const description = receipt.description.trim();

    if (description.length < 2) {
      setErr("Receipt description is required.");
      return;
    }

    const qty = Number(receipt.qty) || 0;
    const rate = Number(receipt.rate) || 0;

    if (qty <= 0) {
      setErr("Quantity must be at least 1.");
      return;
    }

    if (rate <= 0) {
      setErr("Rate must be greater than zero.");
      return;
    }

    const amount = Number((qty * rate).toFixed(2));
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

  const isCategoryMode = transaction === "category";
  const isScanMode = transaction === "scan_receipt";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center px-2">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="expenses-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex w-full ${copy.maxWidth} flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7 ${isScanMode ? "lg:p-8" : ""}`}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 mb-4 sm:mb-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h3
                      id="expenses-modal-title"
                      className="font-display text-lg font-medium tracking-tight"
                    >
                      {copy.title}
                    </h3>
                    {isScanMode && scanning && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-normal uppercase tracking-widest text-[var(--accent-strong)]">
                        <Loader2 size={11} className="animate-spin" />
                        Scanning..
                      </span>
                    )}
                  </div>
                  <p className="mt-1 lg:text-sm text-xs leading-snug text-[var(--ink-muted)]">
                    {copy.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close dialog"
                  className="h-11 w-11 -mr-1 -mt-1 rounded-full flex shrink-0 items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] sm:h-8 sm:w-8 sm:mr-0 sm:mt-0"
                >
                  <X size={16} />
                </button>
              </div>

              {isScanMode && scanning && <ScanOverlay />}

              <div className="shrink-0">
                <ErrorAlert message={err} />
              </div>

              <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 sm:pb-0">
                {isCategoryMode && (
                  <CategoryPanel
                    categories={categories}
                    tableRef={tableRef}
                    newCategory={newCategory}
                    onNewCategoryChange={(e) => setNewCategory(e.target.value)}
                    onSubmit={handleAddCategory}
                    onDeleteCategory={handleDeleteCategory}
                    adding={adding}
                    deletingId={deletingId}
                  />
                )}

                {isScanMode && (
                  <ReceiptPanel
                    receipt={receipt}
                    scanning={scanning}
                    scanFailed={scanFailed}
                    hasScannedContent={hasScannedContent}
                    hasReceiptData={hasReceiptData}
                    itemsTotal={itemsTotal}
                    onSubmit={handleConfirmReceipt}
                    onFilePicked={handleFilePicked}
                    onRemoveRequest={handleRequestRemoveReceipt}
                    onClearReceipt={clearReceipt}
                    onItemChange={handleItemChange}
                    onRemoveItem={handleRemoveItem}
                    onAddItem={handleAddItem}
                  />
                )}

                <ConfirmClearDialog
                  open={confirmClear}
                  onKeep={() => setConfirmClear(false)}
                  onConfirm={handleConfirmClear}
                />
              </div>

              <div className="flex shrink-0 flex-col gap-2 mt-4 pt-4 border-t border-[var(--border)] sm:mt-5 sm:flex-row sm:items-center sm:justify-end sm:pt-5">
                {isScanMode && !hasReceiptImage && !scanning && (
                  <p
                    id="receipt-confirm-hint"
                    className="order-first w-full text-center text-xs leading-snug text-[var(--ink-muted)] sm:hidden"
                  >
                    Upload a receipt above to enable{" "}
                    <span className="font-medium text-[var(--ink)]">
                      Confirm Receipt
                    </span>
                    .
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={busy || scanning}
                  className="order-2 h-12 w-full text-sm sm:order-none sm:h-10 sm:w-auto"
                >
                  {isScanMode ? "Cancel" : "Close"}
                </Button>

                {isScanMode && (
                  <Button
                    type="submit"
                    form="receipt-form"
                    variant="accent"
                    aria-describedby={
                      !hasReceiptImage && !scanning
                        ? "receipt-confirm-hint"
                        : undefined
                    }
                    title={
                      !hasReceiptImage && !scanning
                        ? "Upload a receipt to enable Confirm Receipt"
                        : undefined
                    }
                    disabled={
                      saving ||
                      scanning ||
                      scanFailed ||
                      !hasReceiptImage ||
                      (receipt.items ?? []).length === 0
                    }
                    className="order-1 h-12 w-full text-sm sm:order-none sm:h-10 sm:w-auto"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
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
