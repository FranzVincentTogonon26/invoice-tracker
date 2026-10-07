import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  ReceiptText,
  X,
} from "lucide-react";
import { EXPENSES_RECEIPT_ZOOM } from "@/constants";
import { useExpenseDetail } from "@/hooks/useExpenses";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  isReceiptPdf,
  normalizeReceiptLines,
} from "@/lib/receiptMedia";
import { Button } from "../../../ui/Button";
import { ExpenseDetailsOverview } from "./ExpenseDetailsOverview";
import { ExpenseDetailsReceiptTab } from "./ExpenseDetailsReceiptTab";

const EmployeeExpenseDetailsModal = ({ open, expense, onClose }) => {
  const dialogRef = useRef(null);
  const itemsRegionId = useId();

  const [activeTab, setActiveTab] = useState("details");
  const [failedUrl, setFailedUrl] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const row = expense;

  // Reset state on open or row change
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setActiveTab("details");
    setZoomLevel(1);
    setItemsOpen(false);
    if (!open) setFailedUrl(null);
  }

  const [prevRowId, setPrevRowId] = useState(row?.id);
  if (prevRowId !== row?.id) {
    setPrevRowId(row?.id);
    setActiveTab("details");
    setZoomLevel(1);
    setItemsOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      // handleClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const receiptUrl = row?.imageUrl || "";
  const receiptIsPdf = isReceiptPdf(receiptUrl);
  const hasReceipt = Boolean(row?.receiptId || receiptUrl);
  const canPreviewImage =
    Boolean(receiptUrl) && !receiptIsPdf && failedUrl !== receiptUrl;

  const detailExpenseId = open && hasReceipt && row?.id ? row.id : null;
  const {
    receiptItems,
    vendor: detailVendor,
    isLoading: linesLoading,
    isFetching: linesFetching,
    isError: linesError,
    refetch: refetchLines,
  } = useExpenseDetail(detailExpenseId);
  const linesRefetching = linesFetching && !linesLoading;

  const receiptLines = useMemo(
    () => normalizeReceiptLines(receiptItems),
    [receiptItems],
  );

  const vendorName = String(detailVendor ?? "").trim();
  const title = vendorName || row?.description || "Expense details";

  const handleClose = () => {
    setFailedUrl(null);
    setZoomLevel(1);
    onClose?.();
  };

  const { min, max, step } = EXPENSES_RECEIPT_ZOOM;
  const zoomIn = () =>
    setZoomLevel((z) => Math.min(max, Number((z + step).toFixed(2))));
  const zoomOut = () =>
    setZoomLevel((z) => Math.max(min, Number((z - step).toFixed(2))));
  const zoomReset = () => setZoomLevel(1);

  const flagged = row?.flagged === true || Number(row?.flag) === 1;

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <motion.div
          key="employee-expense-dialog"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
            className={cn(
              "relative max-h-[85dvh] w-full overflow-y-auto scrollbar-slim rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover outline-none sm:p-6 transition-all duration-200",
              hasReceipt && activeTab === "receipt" ? "max-w-2xl" : "max-w-lg",
            )}
          >
            {/* ── Dialog Header ── */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  flagged
                    ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                )}
              >
                <ReceiptText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                  Expense details
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatDate(row?.date)}
                  {row?.date ? ` · ${formatTime(row.date)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close expense details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Segmented Tabs (only when receipt exists) ── */}
            {hasReceipt && (
              <div className="mt-4 flex rounded-xl bg-[var(--surface-2)] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all",
                    activeTab === "details"
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("receipt")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
                    activeTab === "receipt"
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                  )}
                >
                  {receiptIsPdf ? (
                    <FileText size={13} aria-hidden />
                  ) : (
                    <ImageIcon size={13} aria-hidden />
                  )}
                  <span>Receipt &amp; Items</span>
                  {receiptLines.length > 0 && (
                    <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.2 text-[10px] font-normal tabular-nums text-[var(--ink)]">
                      {receiptLines.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* ── Dialog Body ── */}
            {activeTab === "details" ? (
              <ExpenseDetailsOverview
                row={row}
                vendorName={vendorName}
                flagged={flagged}
                hasReceipt={hasReceipt}
                receiptIsPdf={receiptIsPdf}
                receiptCount={receiptLines.length}
                onShowReceipt={() => setActiveTab("receipt")}
              />
            ) : (
              <ExpenseDetailsReceiptTab
                receiptUrl={receiptUrl}
                receiptIsPdf={receiptIsPdf}
                canPreviewImage={canPreviewImage}
                zoomLevel={zoomLevel}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                zoomReset={zoomReset}
                onImageError={() => setFailedUrl(receiptUrl)}
                lines={receiptLines}
                itemsOpen={itemsOpen}
                onToggleItems={() => setItemsOpen((prev) => !prev)}
                linesLoading={linesLoading}
                linesError={linesError}
                onRetryLines={() => refetchLines()}
                linesRefetching={linesRefetching}
                regionId={itemsRegionId}
              />
            )}

            {/* ── Dialog Footer ── */}
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
              {hasReceipt && activeTab === "receipt" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
                >
                  ← Back to overview
                </button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-full px-5 text-xs font-medium"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default EmployeeExpenseDetailsModal;
