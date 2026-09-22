import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Coins,
  Eye,
  ImageOff,
  Receipt as ReceiptIcon,
  Store,
  X,
} from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { LockBodyScroll } from "../../../../hooks/useLockBody";
import { formatDate, formatMoney } from "../../../../lib/utils";

/**
 * Draws a data-URL receipt into a fresh tab. Chrome refuses top-level
 * navigation to `data:` URLs, so the payload is converted to a Blob URL first
 * (and revoked once the tab has had time to load it).
 */
function openReceiptImage(url) {
  if (!url) return;

  try {
    const [meta, base64] = url.split(",");
    if (!base64) throw new Error("not a data url");

    const mime = /:(.*?);/.exec(meta)?.[1] || "image/png";
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      buffer[i] = bytes.charCodeAt(i);
    }

    const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

const MetaRow = ({ label, value, Icon }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className="flex min-w-0 items-center gap-2.5 text-[var(--ink-muted)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)]/70">
        <Icon size={14} />
      </span>
      <span className="type-eyebrow">{label}</span>
    </span>
    <span className="min-w-0 max-w-[60%] flex-1 break-words text-right text-sm font-semibold leading-snug text-[var(--ink)]">
      {value}
    </span>
  </div>
);

// "View Receipt" for a confirmed scan: the temporary draft parked in
// localStorage is rendered as a read-only recap — vendor, date, the scanned
// lines (description / qty / rate / amount) and the grand total, plus the
// stored image when the draft still carries one.
const ReceiptDraftModal = ({ open, receipt, onClose }) => {
  const items = receipt?.items ?? [];
  const itemsTotal = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const total = Number(receipt?.total) > 0 ? Number(receipt.total) : itemsTotal;
  const shortId = String(receipt?.receiptId ?? "")
    .slice(0, 8)
    .toUpperCase();

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/40 p-3 backdrop-blur-sm sm:p-4"
          onClick={onClose}
        >
          <LockBodyScroll />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-draft-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-hover sm:p-6"
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <ReceiptIcon size={18} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3
                      id="receipt-draft-title"
                      className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
                    >
                      Receipt details
                    </h3>
                    {shortId && (
                      <Badge tone="neutral" className="tabular-nums">
                        #{shortId}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm leading-snug text-[var(--ink-muted)]">
                    Scanned receipt attached to this expense line.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close receipt details"
                className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="scrollbar-slim mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              {/* ── Vendor / date / currency ── */}
              <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3.5 py-1.5">
                <MetaRow
                  label="Vendor"
                  value={receipt?.vendor || "Not readable"}
                  Icon={Store}
                />
                <MetaRow
                  label="Date"
                  value={
                    receipt?.date ? formatDate(receipt.date) : "Not readable"
                  }
                  Icon={CalendarDays}
                />
                <MetaRow
                  label="Currency"
                  value={receipt?.currency || "PHP"}
                  Icon={Coins}
                />
              </div>

              {/* ── Scan list items ── */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    Scan list items
                  </h4>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
                    {items.length} {items.length === 1 ? "line" : "lines"}
                  </span>
                </div>

                <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)]">
                  <div className="hidden grid-cols-[minmax(0,1fr)_56px_92px_104px] items-center gap-x-3 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] sm:grid">
                    <span>Description</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                  </div>

                  {items.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-[var(--ink-muted)]">
                      This receipt has no line items.
                    </p>
                  ) : (
                    items.map((item, i) => (
                      <div
                        key={`${item.description}-${i}`}
                        className="border-b border-[var(--border)] px-3 py-2.5 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_56px_92px_104px] sm:items-center sm:gap-x-3 sm:py-2"
                      >
                        <p className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
                          {item.description || `Item ${i + 1}`}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[var(--ink-muted)] sm:mt-0 sm:contents">
                          <span className="tabular-nums sm:text-center">
                            <span className="sm:hidden">Qty </span>
                            {Number(item.quantity) || 0}
                          </span>
                          <span className="tabular-nums sm:text-right">
                            <span className="sm:hidden">Rate </span>
                            {formatMoney(item.rate)}
                          </span>
                          <span className="font-semibold tabular-nums text-[var(--ink)] sm:text-right">
                            {formatMoney(item.amount)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Total ── */}
              <div className="mt-3 rounded-2xl bg-[var(--surface-2)]/70 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
                    Total amount
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>

              {/* ── Attachment (kept locally until the form is saved) ── */}
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/70 px-3.5 py-3">
                {receipt?.imageUrl ? (
                  <>
                    <img
                      src={receipt.imageUrl}
                      alt="Scanned receipt"
                      className="h-16 w-12 shrink-0 rounded-xl border border-[var(--border)] bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        {receipt?.fileName || "Receipt image"}
                      </p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        Stored temporarily in this browser
                      </p>
                    </div>
                    <Button
                      variant="soft"
                      size="sm"
                      type="button"
                      onClick={() => openReceiptImage(receipt.imageUrl)}
                    >
                      <Eye size={13} />
                      Open image
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
                      <ImageOff size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        No image stored
                      </p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        The scanned lines were kept — the image didn&apos;t fit
                        in local storage.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReceiptDraftModal;
