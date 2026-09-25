import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Eye,
  ImageOff,
  ListChecks,
  Loader2,
  ReceiptText,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { MethodIcon } from "../../../ui/Select";
import { useExpenseDetail } from "../../../../hooks/useExpenses";
import { formatDate, formatMoney, formatTime, methodLabel } from "../../../../lib/utils";
import { isReceiptPdf, openReceiptFile } from "../../../../lib/receiptMedia";
import { ExpenseStatusBadge } from "./ExpensesTable";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatQty = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

// ── Recommendations ────────────────────────────────────────────────
const TIP_TONE = {
  warning: {
    wrap: "border-[var(--warning)]/20 bg-[var(--warning)]/8",
    badge: "bg-[var(--warning)] text-white",
    Icon: AlertCircle,
  },
  success: {
    wrap: "border-[var(--success)]/20 bg-[var(--success)]/8",
    badge: "bg-[var(--success)] text-white",
    Icon: CircleCheck,
  },
  neutral: {
    wrap: "border-[var(--border)] bg-[var(--surface)]",
    badge: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    Icon: Sparkles,
  },
};

const RecommendationTip = ({ tip }) => {
  const tone = TIP_TONE[tip.tone] ?? TIP_TONE.neutral;
  const Icon = tone.Icon;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${tone.wrap}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}
      >
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-[var(--ink)]">
          {tip.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
          {tip.body}
        </p>
      </div>
    </div>
  );
};

// ── Receipt list — full width, not squeezed
// Data comes straight from the `receipt` table via GET /expenses/detail/:id
// (Expenses.receiptLinesForExpense) — no re-scan. Count + DB sum live on the
// toggle above, so the list itself stays label-free.
const ReceiptLineList = ({ lines }) => (
  <ul className="space-y-2">
    {lines.map((item) => (
      <li
        key={item.key}
        className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/40"
      >
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium leading-snug text-[var(--ink)]">
            {item.description || "Unnamed item"}
          </p>
          <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
            × {formatQty(item.quantity)} @ {formatMoney(item.rate)} each
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(item.amount)}
        </span>
      </li>
    ))}
  </ul>
);

const EmployeeBlock = ({ name, role, avatarUrl }) => (
  <div className="flex items-center gap-3">
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
      />
    ) : (
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-strong)]"
      >
        {initialsOf(name) || "?"}
      </span>
    )}
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold leading-tight text-[var(--ink)]">
        {name || "Unknown"}
      </p>
      <p className="truncate text-xs capitalize text-[var(--ink-muted)]">
        {role || "—"}
      </p>
    </div>
  </div>
);

const ExpenseDetailsModal = ({
  open,
  expense,
  referenceLabel = "",
  onClose,
}) => {
  const titleId = useId();
  const itemsRegionId = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const row = expense;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setFailedUrl(null);
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

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
    () =>
      (receiptItems ?? []).map((item, index) => {
        const quantity = toNumber(item?.qty);
        const rate = toNumber(item?.rate);
        return {
          key: `${item?.id ?? "line"}-${index}`,
          description: String(item?.description ?? "").trim(),
          quantity,
          rate,
          amount: toNumber(item?.amount),
        };
      }),
    [receiptItems],
  );

  const linesTotal = useMemo(
    () =>
      Number(
        receiptLines.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      ),
    [receiptLines],
  );

  const recordedTotal = toNumber(row?.amount);

  const vendorName = String(detailVendor ?? "").trim();

  const [openItemsFor, setOpenItemsFor] = useState(null);
  const itemsOpen =
    hasReceipt &&
    !linesLoading &&
    !linesError &&
    receiptLines.length > 0 &&
    openItemsFor === row?.id;

  const recommendations = useMemo(() => {
    const tips = [];
    if (!open || !row) return tips;

    // DB is source of truth — linesTotal is SUM(receipt.amount) from
    // receipt table, not a re-scan. No mismatch warning: divergence is
    // expected (tax/discount edits, toIntQty rounding, user edits to
    // expenses.total_amount). Show DB rows as-is.
    if (hasReceipt && !receiptUrl) {
      tips.push({
        key: "no-image",
        tone: "warning",
        title: "Receipt image missing",
        body: "A receipt is linked but no file is stored. Re-attach if you need the paper trail.",
      });
    }
    if (!row?.category) {
      tips.push({
        key: "no-category",
        tone: "neutral",
        title: "Add a category",
        body: "Helps the overview cards and filters stay accurate.",
      });
    }
    if (!row?.notes) {
      tips.push({
        key: "no-notes",
        tone: "neutral",
        title: "Add a note",
        body: "A short purpose or project tag helps future audits.",
      });
    }
    if (!referenceLabel && row?.referenceId) {
      tips.push({
        key: "closed-source",
        tone: "neutral",
        title: "Source of funds closed",
        body: "The budget reference is no longer open, so the label can’t be shown.",
      });
    }

    // Only show “all good” when there’s truly nothing else to say — and treat
    // that as “no recommendations” so the section stays hidden. Keeps the modal
    // focused on what needs action.
    if (tips.length === 0) return [];

    return tips;
  }, [open, row, hasReceipt, receiptUrl, referenceLabel]);

  const hasRecommendations = recommendations.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/35 p-3 backdrop-blur-md sm:p-4"
          onClick={() => {
            setFailedUrl(null);
            onClose?.();
          }}
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
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[880px] flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-4 pb-3.5 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
              <div className="min-w-0 flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <ReceiptText size={18} aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3
                    id={titleId}
                    className="font-display text-[17px] font-semibold tracking-tight text-[var(--ink)]"
                  >
                    Expense details
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--ink-muted)]">
                    {vendorName || formatDate(row?.date) || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFailedUrl(null);
                  onClose?.();
                }}
                aria-label="Close expense details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
                {/* Hero — amount + core context, no redundant labels */}
                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[15px] font-semibold leading-snug text-[var(--ink)]">
                        {row?.description || "Untitled expense"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <ExpenseStatusBadge status={row?.status} />
                        <Badge tone="accent" className="max-w-full">
                          <span className="truncate">
                            {row?.category || "Uncategorized"}
                          </span>
                        </Badge>
                      </div>
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="sr-only">Amount</p>
                      <p className="font-display text-[26px] font-semibold tabular-nums leading-none tracking-tight text-[var(--ink)] sm:text-[28px]">
                        {formatMoney(recordedTotal)}
                      </p>
                    </div>
                  </div>

                  {/* essential meta as pills — no MetaRow wall */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">
                      <CalendarDays
                        size={13}
                        aria-hidden
                        className="shrink-0"
                      />
                      {formatDate(row?.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">
                      <MethodIcon
                        method={row?.method}
                        className="h-3.5 w-3.5"
                      />
                      {methodLabel(row?.method)}
                    </span>
                    {referenceLabel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)]">
                        <Wallet size={13} aria-hidden className="shrink-0" />
                        <span className="truncate max-w-[14rem]">
                          {referenceLabel}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* notes — soft quote, no nested card or label */}
                  {row?.notes && (
                    <p className="mt-3 border-l-2 border-[var(--accent)]/40 pl-3 text-sm italic leading-relaxed text-[var(--ink-muted)]">
                      {row.notes}
                    </p>
                  )}

                  {/* filed by — merged row, no extra card */}
                  <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                    <EmployeeBlock
                      name={row?.employee}
                      role={row?.employeeRole}
                      avatarUrl={row?.employeeAvatar}
                    />
                    <span className="shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
                      Filed {formatTime(row?.timeDate)}
                    </span>
                  </div>
                </div>

                {/* Receipt */}
                {hasReceipt && (
                  <section aria-label="Receipt" className="space-y-3">
                    <div className="px-1">
                      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                        <ReceiptText
                          size={13}
                          aria-hidden
                          className="text-[var(--accent-strong)]"
                        />
                        Receipt
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {/* image — full width so the item list below stays breathable and not squeezed into a half column */}
                      {canPreviewImage ? (
                        <button
                          type="button"
                          onClick={() => openReceiptFile(receiptUrl)}
                          aria-label="Open receipt image"
                          className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#101817] p-2.5 sm:p-3"
                        >
                          <img
                            src={receiptUrl}
                            alt="Stored receipt"
                            onError={() => setFailedUrl(receiptUrl)}
                            className="mx-auto max-h-[300px] w-full max-w-[420px] rounded-xl bg-white object-contain shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-[1.01] sm:max-h-[360px]"
                          />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/65 px-3 py-2.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            <Eye size={13} aria-hidden />
                            Tap to enlarge
                          </span>
                        </button>
                      ) : (
                        <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-5 text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
                            <ImageOff size={16} aria-hidden />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[var(--ink)]">
                              {receiptIsPdf
                                ? "PDF receipt"
                                : receiptUrl
                                  ? "Preview unavailable"
                                  : "No image stored"}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
                              {receiptUrl
                                ? "Open the file to review it."
                                : "Itemized lines are still shown below."}
                            </p>
                          </div>
                          {receiptUrl && (
                            <Button
                              type="button"
                              variant="soft"
                              size="sm"
                              onClick={() => openReceiptFile(receiptUrl)}
                            >
                              <Eye size={14} aria-hidden />
                              {receiptIsPdf ? "Open PDF" : "Open file"}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* lines — full width, not compressed into a side column */}
                      <div
                        aria-busy={linesLoading || undefined}
                        aria-live="polite"
                      >
                        {linesLoading ? (
                          <div
                            className="space-y-2"
                            role="status"
                            aria-label="Loading receipt lines"
                          >
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="h-[68px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60"
                              />
                            ))}
                          </div>
                        ) : linesError ? (
                          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/8 px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--danger)]/15 text-[var(--danger)]">
                                <AlertCircle size={14} aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--ink)]">
                                  Couldn’t load items
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
                                  The receipt image is fine — only the line list
                                  failed.
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="soft"
                              size="sm"
                              onClick={() => refetchLines()}
                              disabled={linesRefetching}
                              className="self-start"
                            >
                              {linesRefetching && (
                                <Loader2
                                  size={13}
                                  className="animate-spin"
                                  aria-hidden
                                />
                              )}
                              Retry
                            </Button>
                          </div>
                        ) : receiptLines.length === 0 ? (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-6 text-center">
                            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--ink-muted)]">
                              <ListChecks size={16} aria-hidden />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">
                              No line items
                            </p>
                            <p className="mx-auto mt-1 max-w-[22ch] text-xs leading-relaxed text-[var(--ink-muted)]">
                              Nothing was itemized when this was scanned — the
                              recorded amount stands alone.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenItemsFor((prev) =>
                                  prev === row?.id ? null : (row?.id ?? null),
                                )
                              }
                              aria-expanded={itemsOpen}
                              aria-controls={itemsRegionId}
                              className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--accent)]/25 hover:bg-[var(--surface-2)]/40"
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
                                    {receiptLines.length === 1
                                      ? "line"
                                      : "lines"}{" "}
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
                                  <div className="pt-2.5">
                                    <ReceiptLineList lines={receiptLines} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Recommendations — only when there’s something to act on */}
                {hasRecommendations && (
                  <section aria-label="Insights" className="space-y-3">
                    <div className="px-1">
                      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                        <Sparkles
                          size={13}
                          aria-hidden
                          className="text-[var(--accent-strong)]"
                        />
                        Insights
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {recommendations.map((tip) => (
                        <RecommendationTip key={tip.key} tip={tip} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFailedUrl(null);
                  onClose?.();
                }}
                className="rounded-full"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpenseDetailsModal;
