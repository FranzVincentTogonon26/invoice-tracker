import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  X,
} from "lucide-react";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import {
  hasOverviewReceipt,
  isFlagged,
  overviewConfigFor,
  overviewTitle,
} from "@/lib/overviewLedger";
import { useExpenseDetail } from "../../../../hooks/useExpenses";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";
import { Button } from "../../../ui/Button";
import { OverviewDetailsBody } from "./OverviewDetailsBody";

/* ── Mobile bottom sheet — same slide-up as the budget sheet ── */
// Mobile-only (md:hidden): tapping a card opens this portal with the
// tapped row's details + summary. Desktop keeps the plain table.

// Premium staggered entrance: once the panel slides up, its inner sections
// rise in sequence (grabber → header → body → actions) with a soft
// rise-and-fade. Re-keyed per row so switching rows replays the sequence.
const contentVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.22 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// In-sheet receipt view — slides in from the right over the details (and
// back out the same way), so the receipt opens inside the sheet instead of
// a separate modal.
const receiptPaneTransition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
};

// Faster cascade for the sliding receipt pane — the shared content stagger
// waits 0.22s, which would leave the pane blank while it travels.
const receiptContentVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.14 },
  },
};

// Horizontal-only cascade for the receipt pane: every section travels
// right-to-left with a smooth glide — no vertical rise.
const receiptItemVariants = {
  hidden: { opacity: 0, x: 48 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

function SheetReceiptView({ row, onBack }) {
  const receiptUrl = row?.imageUrl ?? row?.image_url ?? "";
  const receiptIsPdf = isReceiptPdf(receiptUrl);
  const canPreviewImage = Boolean(receiptUrl) && !receiptIsPdf;
  const [failedUrl, setFailedUrl] = useState(null);
  // Skeleton-first image: shimmer block until the file finishes loading so
  // the card never paints empty/broken mid-flight.
  const [imgLoaded, setImgLoaded] = useState(false);
  // Scanned line items load only while this pane is mounted.
  const {
    receiptItems,
    isLoading: linesLoading,
    isError: linesError,
    refetch: refetchLines,
  } = useExpenseDetail(row?.kind === "expense" ? row?.id : null);
  const lines = (receiptItems ?? []).map((item, index) => ({
    key: `${item?.id ?? "line"}-${index}`,
    description: String(item?.description ?? "").trim() || "Unnamed item",
    amount: Number(item?.amount) || 0,
  }));
  const itemsTotal = lines.reduce((sum, it) => sum + (it.amount || 0), 0);
  const showPreview = canPreviewImage && failedUrl !== receiptUrl;

  return (
    <motion.div
      variants={receiptContentVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={receiptItemVariants}
        className="sticky -top-5 z-10 -mx-4 bg-[var(--surface)]/90 px-4 py-5 rounded-t-3xl backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-medium leading-tight tracking-tight text-[var(--ink)]">
              Receipt
            </p>
            <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
              {formatDate(row?.date)}
              {row?.date ? ` · ${formatTime(row.date)}` : ""}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={receiptItemVariants}
        className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        {showPreview ? (
          <div className="bg-[var(--surface-2)]/30 ">
            <div className="relative overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10">
              {!imgLoaded && (
                <div
                  aria-hidden
                  className="h-56 w-full animate-pulse bg-[var(--surface-2)]"
                />
              )}
              <img
                src={receiptUrl}
                alt="Scanned receipt"
                onLoad={() => setImgLoaded(true)}
                onError={() => setFailedUrl(receiptUrl)}
                className={cn(
                  "block h-56 w-full bg-white object-cover",
                  !imgLoaded && "hidden",
                )}
              />
              {imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--ink)]/25">
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() => openReceiptFile(receiptUrl)}
                    className="gap-1.5 shadow-lg"
                  >
                    <Maximize2 size={12} aria-hidden />
                    {receiptIsPdf ? "Open PDF document" : "Full size"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {receiptIsPdf ? (
                <FileText size={22} aria-hidden />
              ) : (
                <ImageIcon size={22} aria-hidden />
              )}
            </span>
            <p className="text-xs text-[var(--ink-muted)]">
              {receiptUrl
                ? "Open the original file to view it."
                : "No receipt image attached"}
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        variants={receiptItemVariants}
        className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Scanned items
          </p>
          {lines.length > 0 && (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
              {lines.length}
            </span>
          )}
        </div>
        {linesLoading ? (
          <div
            role="status"
            aria-label="Loading receipt items"
            className="space-y-2 p-4"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-4 animate-pulse rounded bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : linesError ? (
          <div className="flex items-center gap-2 p-4">
            <p className="min-w-0 flex-1 text-xs font-medium text-[var(--danger)]">
              Couldn&apos;t load receipt items
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refetchLines()}
            >
              Retry
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <p className="p-4 text-center text-xs text-[var(--ink-muted)]">
            No itemized lines found
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]/60">
              {lines.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate text-[var(--ink)]">
                    {item.description}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--ink)]">
                    {formatMoney(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--accent)]/30 bg-[var(--accent-soft)]/60 px-4 py-3 text-xs">
              <span className="font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                Items total
              </span>
              <span className="font-display text-sm font-semibold tabular-nums text-[var(--accent-strong)]">
                {formatMoney(itemsTotal)}
              </span>
            </div>
          </>
        )}
      </motion.div>
      <div className="mt-3 ">
        <motion.div variants={itemVariants} className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBack}
          >
            <ArrowLeft size={15} aria-hidden />
            Back to view details
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
export function OverviewSheet({ row, onClose }) {
  const sheetRef = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);
  // In-sheet receipt pane — slides in from the right over the details
  // instead of opening a separate modal. Resets whenever another row opens.
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [prevSheetRowId, setPrevSheetRowId] = useState(row?.id);
  if (row?.id !== prevSheetRowId) {
    setPrevSheetRowId(row?.id);
    setReceiptOpen(false);
  }

  useEffect(() => {
    if (!row) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      // Escape steps back out of the receipt pane first.
      if (receiptOpen) {
        setReceiptOpen(false);
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [row, close, receiptOpen]);

  // Restart at the top whenever the pane swaps.
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [receiptOpen, row?.id]);

  const meta = overviewConfigFor(row?.kind);
  const Icon = meta.Icon;
  // Shared with the desktop dialog so both headers read identically.
  const title = overviewTitle(row, meta);
  // An expense carrying a receipt offers a jump into the full receipt UI.
  const hasReceipt = hasOverviewReceipt(row);

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="overview-sheet"
          className="fixed inset-0 z-[70] flex flex-col justify-end md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{
              duration: 0.46,
              ease: PANEL_EASE,
              delay: 0.12,
              layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
            }}
            layout
            className={cn(
              "scrollbar-slim relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain outline-none",
              "rounded-t-[15px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover will-change-transform",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <AnimatePresence mode="wait">
              {receiptOpen ? (
                <motion.div
                  key="overview-sheet-receipt"
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{
                    x: "0%",
                    opacity: 1,
                    transition: { ...receiptPaneTransition, delay: 0.06 },
                  }}
                  exit={{
                    x: "100%",
                    opacity: 0,
                    transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] },
                  }}
                >
                  <SheetReceiptView
                    row={row}
                    onBack={() => setReceiptOpen(false)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={row?.id ?? "overview-sheet-content"}
                  variants={contentVariants}
                  initial="hidden"
                  animate="show"
                  exit={{
                    opacity: 0,
                    x: "-40%",
                    transition: { duration: 0.25 },
                  }}
                >
                  <motion.div
                    aria-hidden
                    variants={itemVariants}
                    className="mx-auto h-1.5 w-10 rounded-full bg-[var(--ink-muted)]/25"
                  />
                  <motion.div
                    variants={itemVariants}
                    className="flex items-center gap-3 pt-4"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        isFlagged(row)
                          ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                          : meta.iconWrapperClass,
                      )}
                    >
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                        {title}
                      </p>
                      <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                        {formatDate(row?.date)}
                        {row?.date ? ` · ${formatTime(row.date)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close transaction preview"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <OverviewDetailsBody row={row} meta={meta} />
                  </motion.div>
                  {hasReceipt && (
                    <motion.div variants={itemVariants} className="mt-4">
                      <Button
                        type="button"
                        variant="accent"
                        className="w-full"
                        onClick={() => setReceiptOpen(true)}
                      >
                        <Eye size={15} aria-hidden />
                        View details & receipt
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default OverviewSheet;
