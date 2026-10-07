import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ImagePlus,
  RotateCcw,
  ScanLine,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { useAuth } from "../../../../context/AuthContext";
import { useReceiptScan } from "../../../../hooks/useReceiptScan";
import {
  ERROR_VISIBLE_MS,
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_LABEL,
  USER_ROLES,
} from "../../../../constants";
import { formatMoney } from "../../../../lib/utils";
import ReceiptDropzone from "../../expenses/ReceiptDropzone";
import ScanOverlay from "../../expenses/ScanOverlay";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

/**
 * Admin-only receipt scanner for the Issue Budget amount field.
 *
 * Lives beside BudgetModal (never on employee routes): drop or upload a
 * receipt image, the shared AI scan reads vendor + grand total, and
 * "Use scanned amount" hands everything back through `onConfirm({ total,
 * vendor, fileName, file })` so the caller can fill its Amount input and
 * upload the held file with the issuance. Nothing is stored server-side
 * until then — the scan endpoint only parses from memory, and the picked
 * file never leaves the browser before confirm.
 */
const BudgetScanModal = ({ open, onClose, onConfirm }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const notifySuccess = (message) => {
    if (!isAdmin) return;
    toast.success(message);
  };
  const notifyError = (message) => {
    if (!isAdmin) return;
    toast.error(message);
  };

  const [err, setErr] = useState("");
  const [scanned, setScanned] = useState(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  // The picked File itself — handed back through onConfirm so the caller can
  // upload it with the issuance (deferred: nothing is stored until confirm).
  const [pickedFile, setPickedFile] = useState(null);

  const previewUrlRef = useRef("");
  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  useEffect(() => {
    if (!err) return undefined;
    const id = setTimeout(() => setErr(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [err]);

  // Reset every time the modal opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setErr("");
    setScanned(null);
    setFileName("");
    setPreviewUrl("");
    setPickedFile(null);
    releasePreview();
  }

  const fail = useCallback(
    (message) => {
      setErr(message);
      notifyError(message);
    },
    // notifyError closes over isAdmin — stable per session role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  const handleParsed = useCallback(
    (parsed) => {
      const total = Number(parsed.total) || 0;
      if (!(total > 0)) {
        fail("The scanned receipt has no readable total — try a clearer photo.");
        return;
      }
      setScanned(parsed);
      notifySuccess("Receipt scanned — review the total below.");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  const { loading: scanning, scanFile } = useReceiptScan({
    onParsed: handleParsed,
    onError: fail,
  });

  const handleFile = useCallback(
    (file) => {
      setErr("");
      if (!file || scanning) return;
      if (file.size > MAX_RECEIPT_BYTES) {
        fail(`Receipt must be ${MAX_RECEIPT_LABEL} or smaller.`);
        return;
      }
      releasePreview();
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setFileName(file.name || "Receipt");
      setPickedFile(file);
      setScanned(null);
      scanFile(file);
    },
    [scanning, scanFile, fail, releasePreview],
  );

  const handleScanAnother = () => {
    if (scanning) return;
    releasePreview();
    setPreviewUrl("");
    setFileName("");
    setPickedFile(null);
    setScanned(null);
    setErr("");
  };

  const handleClose = () => {
    if (scanning) return;
    setErr("");
    onClose?.();
  };

  const handleUseAmount = () => {
    if (scanning || !scanned) return;
    onConfirm?.({
      total: Number(scanned.total),
      vendor: scanned.vendor || "",
      fileName,
      file: pickedFile,
    });
    setErr("");
    onClose?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (scanning) return;
      e.stopPropagation();
      setErr("");
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, scanning, onClose]);

  const total = Number(scanned?.total) || 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center px-2"
            onClick={handleClose}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-scan-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: DIALOG_EASE }}
              className="relative w-full max-w-[440px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-5 sm:p-6"
            >
              {/* Covers the whole dialog while scanning (not just the
                  dropzone box) so the overlay content never overflows or
                  squeezes the layout. */}
              {scanning && <ScanOverlay />}

              <div className="flex shrink-0 items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3
                    id="budget-scan-title"
                    className="font-display text-lg font-medium tracking-tight flex items-center gap-2"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <ScanLine size={16} />
                    </span>
                    Scan receipt amount
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-[var(--ink-muted)]">
                    Drop or upload a receipt — the scanned total fills the
                    Amount field.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close scan dialog"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                {!scanned ? (
                  <ReceiptDropzone scanning={scanning} onFile={handleFile} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-[var(--border)]"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                          <ImagePlus size={16} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">
                          {scanned.vendor || fileName || "Scanned receipt"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                          {(scanned.lineItems ?? []).length} line
                          {(scanned.lineItems ?? []).length === 1 ? "" : "s"}{" "}
                          read
                        </p>
                      </div>
                      <Badge tone="accent">Scanned</Badge>
                    </div>

                    <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
                      <p className="type-eyebrow text-[var(--accent-strong)]">
                        Scanned total
                      </p>
                      <p className="mt-1 font-display text-3xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
                        {formatMoney(total)}
                      </p>
                    </div>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {err && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto", marginTop: 12 }}
                      exit={{
                        opacity: 0,
                        y: -4,
                        height: 0,
                        marginTop: 0,
                        transition: { duration: 0.25, ease: "easeOut" },
                      }}
                      className="flex items-start gap-2 overflow-hidden rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-sm leading-snug text-[var(--danger)]"
                    >
                      <AlertCircle size={17} className="mt-px shrink-0" />
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 mt-4 pt-4 border-t border-[var(--border)] sm:flex-row sm:items-center sm:justify-end">
                {scanned ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleScanAnother}
                      disabled={scanning}
                      className="w-full sm:w-auto"
                    >
                      <RotateCcw size={14} />
                      Scan another
                    </Button>
                    <Button
                      type="button"
                      variant="accent"
                      onClick={handleUseAmount}
                      disabled={scanning}
                      className="w-full sm:w-auto"
                    >
                      Use scanned amount
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={scanning}
                    className="w-full sm:w-auto"
                  >
                    Cancel
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

export default BudgetScanModal;
