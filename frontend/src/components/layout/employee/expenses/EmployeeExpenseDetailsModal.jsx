import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Eye,
  ImageOff,
  ListChecks,
  ReceiptText,
  X,
} from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { MethodIcon } from "../../../ui/Select";
import { useExpenseDetail } from "../../../../hooks/useExpenses";
import {
  formatDate,
  formatMoney,
  formatTime,
  methodLabel,
} from "../../../../lib/utils";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const STATUS_META = {
  paid: { tone: "success", label: "Paid" },
  draft: { tone: "warning", label: "Draft" },
  cancel: { tone: "danger", label: "Cancelled" },
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatQty = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

// One compact pill — the whole meta row, no labelled key/value wall.
const MetaPill = ({ icon, children }) => (
  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">
    <span className="flex shrink-0 items-center">{icon}</span>
    <span className="truncate">{children}</span>
  </span>
);

/**
 * Employee "View expense" dialog — the lean counterpart of the admin details
 * modal: the recorded figures plus the receipt, and nothing else (no filed-by
 * row, no insights: the row already belongs to the person reading it).
 *
 * The receipt itemized lines sit behind a toggle so the default view stays
 * short instead of pushing the recorded details below the fold.
 */
const EmployeeExpenseDetailsModal = ({ open, expense, onClose }) => {
  const titleId = useId();
  const itemsRegionId = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const [itemsOpen, setItemsOpen] = useState(false);

  const row = expense;

  useEffect(() => {
    if (!open) return undefined;
    setItemsOpen(false);
    setFailedUrl(null);
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const close = () => {
    setFailedUrl(null);
    onClose?.();
  };

  const receiptUrl = row?.imageUrl || "";
  const receiptIsPdf = isReceiptPdf(receiptUrl);
  const hasReceipt = Boolean(row?.receiptId || receiptUrl);
  const canPreviewImage =
    Boolean(receiptUrl) && !receiptIsPdf && failedUrl !== receiptUrl;

  const detailId = open && hasReceipt && row?.id ? row.id : null;
  const {
    receiptItems,
    isLoading: linesLoading,
    isError: linesError,
    refetch: refetchLines,
  } = useExpenseDetail(detailId);

  const receiptLines = useMemo(
    () =>
      (receiptItems ?? []).map((item, index) => ({
        key: `${item?.id ?? "line"}-${index}`,
        description: String(item?.description ?? "").trim(),
        quantity: toNumber(item?.qty),
        rate: toNumber(item?.rate),
        amount: toNumber(item?.amount),
      })),
    [receiptItems],
  );

  const linesTotal = useMemo(
    () =>
      Number(
        receiptLines.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      ),
    [receiptLines],
  );

  const status = STATUS_META[row?.status] ?? {
    tone: "neutral",
    label: row?.status || "—",
  };

  // Portalled to `document.body`: the section sits inside an animated card
  // (framer-motion leaves a transform on an ancestor), which would otherwise
  // trap this `fixed` overlay and clip it to the card.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/35 p-3 backdrop-blur-md sm:p-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.24, ease: DIALOG_EASE }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <ReceiptText size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="font-display text-base font-semibold tracking-tight text-[var(--ink)]"
                  >
                    Expense details
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {formatDate(row?.date) || "—"}
                    {row?.timeDate ? ` · ${formatTime(row.timeDate)}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close expense details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-4">
                {/* Amount + description + status/category */}
                <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-[var(--ink)]">
                        {row?.description || "Untitled expense"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={status.tone} className="gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {status.label}
                        </Badge>
                        {row?.category && (
                          <Badge tone="accent" className="max-w-full">
                            <span className="truncate">{row.category}</span>
                          </Badge>
                        )}
                        <MetaPill icon={<CalendarDays size={13} aria-hidden />}>
                          {formatDate(row?.date)}
                        </MetaPill>
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="sr-only">Amount</p>
                      <p className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-[var(--ink)]">
                        {formatMoney(toNumber(row?.amount))}
                      </p>
                      <MetaPill
                        icon={
                          <MethodIcon
                            method={row?.method}
                            className="h-3.5 w-3.5"
                          />
                        }
                      >
                        {methodLabel(row?.method)}
                      </MetaPill>
                    </div>
                  </div>

                  {row?.notes && (
                    <p className="mt-3 border-l-2 border-[var(--accent)]/40 pl-3 text-sm italic leading-relaxed text-[var(--ink-muted)]">
                      {row.notes}
                    </p>
                  )}
                </section>

                {/* ── Receipt ── */}
                {hasReceipt && (
                  <section aria-label="Receipt" className="space-y-3">
                    <h4 className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                      <ReceiptText
                        size={13}
                        aria-hidden
                        className="text-[var(--accent-strong)]"
                      />
                      Receipt
                    </h4>

                    {canPreviewImage ? (
                      <button
                        type="button"
                        onClick={() => openReceiptFile(receiptUrl)}
                        aria-label="Open receipt image"
                        className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#101817] p-2.5"
                      >
                        <img
                          src={receiptUrl}
                          alt="Stored receipt"
                          onError={() => setFailedUrl(receiptUrl)}
                          className="mx-auto max-h-[260px] w-full max-w-[380px] rounded-xl bg-white object-contain shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-[1.01]"
                        />
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/65 px-3 py-2.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Eye size={13} aria-hidden />
                          Tap to enlarge
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-h-[110px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-4 text-center">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
                          <ImageOff size={15} aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {receiptIsPdf
                              ? "PDF receipt"
                              : receiptUrl
                                ? "Preview unavailable"
                                : "No image stored"}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                            {receiptUrl
                              ? "Open the file to review it."
                              : "Itemized lines may still be listed below."}
                          </p>
                        </div>
                        {receiptUrl && (
                          <Button
                            type="button"
                            variant="soft"
                            size="sm"
                            onClick={() => openReceiptFile(receiptUrl)}
                          >
                            {receiptIsPdf ? "Open PDF" : "Open file"}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Itemized lines — collapsed by default so the receipt
                        never eats the whole dialog. */}
                    <div aria-busy={linesLoading || undefined}>
                      {linesLoading ? (
                        <div
                          className="space-y-2"
                          role="status"
                          aria-label="Loading receipt items"
                        >
                          {[0, 1].map((i) => (
                            <div
                              key={i}
                              className="h-14 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60"
                            />
                          ))}
                        </div>
                      ) : linesError ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/8 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AlertCircle
                              size={15}
                              aria-hidden
                              className="shrink-0 text-[var(--danger)]"
                            />
                            <p className="text-sm font-semibold text-[var(--ink)]">
                              Couldn’t load items
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="soft"
                            size="sm"
                            onClick={() => refetchLines()}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : receiptLines.length === 0 ? (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-5 text-center">
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            No line items
                          </p>
                          <p className="mt-1 text-xs text-[var(--ink-muted)]">
                            Nothing was itemized when this was scanned.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={() => setItemsOpen((v) => !v)}
                            aria-expanded={itemsOpen}
                            aria-controls={itemsRegionId}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--accent)]/25 hover:bg-[var(--surface-2)]/40"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                                <ListChecks size={16} aria-hidden />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-[var(--ink)]">
                                  {itemsOpen ? "Hide items" : "View items"}
                                </span>
                                <span className="block truncate text-xs tabular-nums text-[var(--ink-muted)]">
                                  {receiptLines.length}{" "}
                                  {receiptLines.length === 1 ? "line" : "lines"}{" "}
                                  · {formatMoney(linesTotal)}
                                </span>
                              </span>
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]">
                              <ChevronDown
                                size={16}
                                aria-hidden
                                className={`transition-transform duration-200 ${itemsOpen ? "rotate-180" : ""}`}
                              />
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {itemsOpen && (
                              <motion.div
                                key="receipt-items"
                                id={itemsRegionId}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: 0.24,
                                  ease: DIALOG_EASE,
                                }}
                                className="overflow-hidden"
                              >
                                <ul className="space-y-2 pt-2.5">
                                  {receiptLines.map((item) => (
                                    <li
                                      key={item.key}
                                      className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="break-words text-sm font-medium leading-snug text-[var(--ink)]">
                                          {item.description || "Unnamed item"}
                                        </p>
                                        <p className="mt-0.5 text-xs tabular-nums text-[var(--ink-muted)]">
                                          × {formatQty(item.quantity)} @{" "}
                                          {formatMoney(item.rate)} each
                                        </p>
                                      </div>
                                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                                        {formatMoney(item.amount)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className="rounded-full"
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
