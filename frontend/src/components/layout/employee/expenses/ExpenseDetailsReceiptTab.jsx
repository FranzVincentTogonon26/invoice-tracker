import {
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  ReceiptText,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { EXPENSES_RECEIPT_ZOOM } from "@/constants";
import { openReceiptFile } from "@/lib/receiptMedia";
import { Button } from "../../../ui/Button";
import { ExpenseLineItemsSection } from "./ExpenseDetailsLineItems";

// "Receipt & Items" tab of the expense details modal: zoomable receipt
// preview (image, PDF placeholder, or empty state) plus the scanned
// line-items section below it.
export function ExpenseDetailsReceiptTab({
  receiptUrl,
  receiptIsPdf,
  canPreviewImage,
  zoomLevel,
  zoomIn,
  zoomOut,
  zoomReset,
  onImageError,
  lines,
  itemsOpen,
  onToggleItems,
  linesLoading,
  linesError,
  onRetryLines,
  linesRefetching,
  regionId,
}) {
  const { min, max } = EXPENSES_RECEIPT_ZOOM;
  return (
    <div className="mt-4 space-y-4">
      <section
        aria-label="Receipt document"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--ink)]">
            <ImageIcon size={13} aria-hidden className="shrink-0" />
            <span className="truncate">Receipt preview</span>
            {zoomLevel !== 1 ? (
              <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent-strong)]">
                {Math.round(zoomLevel * 100)}%
              </span>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomLevel <= min}
              title="Zoom out"
              aria-label="Zoom out receipt image"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
            >
              <ZoomOut size={13} aria-hidden />
            </button>
            <button
              type="button"
              onClick={zoomReset}
              disabled={zoomLevel === 1}
              title="Reset zoom"
              aria-label="Reset receipt zoom"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
            >
              <RotateCcw size={12} aria-hidden />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomLevel >= max}
              title="Zoom in"
              aria-label="Zoom in receipt image"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
            >
              <ZoomIn size={13} aria-hidden />
            </button>
            <span aria-hidden className="mx-1 h-3 w-px bg-[var(--border)]" />
            <button
              type="button"
              onClick={() => openReceiptFile(receiptUrl)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-strong)] transition-opacity hover:opacity-90"
            >
              <Maximize2 size={12} aria-hidden />
              Full size
            </button>
          </div>
        </div>

        {canPreviewImage ? (
          <div className="scrollbar-slim relative max-h-[460px] min-h-[240px] overflow-auto bg-[var(--surface-2)]/30 p-3 sm:p-4">
            <img
              src={receiptUrl}
              alt="Scanned receipt"
              onError={onImageError}
              style={{ transform: `scale(${zoomLevel})` }}
              className="mx-auto block w-auto max-w-full rounded-lg bg-white object-contain shadow-md transition-transform duration-150"
            />
          </div>
        ) : receiptUrl ? (
          <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 bg-[var(--surface-2)]/40 p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {receiptIsPdf ? (
                <FileText size={24} aria-hidden />
              ) : (
                <ImageIcon size={24} aria-hidden />
              )}
            </span>
            <div className="max-w-[280px] space-y-1">
              <p className="text-sm font-medium text-[var(--ink)]">
                {receiptIsPdf ? "PDF document receipt" : "Receipt attachment"}
              </p>
              <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
                {receiptIsPdf
                  ? "This expense is linked to a PDF file."
                  : "Open the original file to view it."}
              </p>
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => openReceiptFile(receiptUrl)}
              className="gap-1.5"
            >
              <Eye size={14} aria-hidden />
              {receiptIsPdf ? "Open PDF document" : "Open file"}
            </Button>
          </div>
        ) : (
          <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 p-6 text-center">
            <ReceiptText size={22} className="text-[var(--ink-muted)]" />
            <p className="text-xs text-[var(--ink-muted)]">
              No receipt image attached
            </p>
          </div>
        )}
      </section>

      <ExpenseLineItemsSection
        lines={lines}
        open={itemsOpen}
        onToggle={onToggleItems}
        loading={linesLoading}
        error={linesError}
        onRetry={onRetryLines}
        refetching={linesRefetching}
        regionId={regionId}
      />
    </div>
  );
}

export default ExpenseDetailsReceiptTab;
