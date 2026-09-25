import { Store, CalendarDays, Coins } from "lucide-react";
import { CardTitle } from "../../ui/Card";

const ROW = "flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0";

// Vendor / date / currency block inside the Details card. Handles both the
// "couldn't read vendor details" fallback and the skeleton while scanning.
const ReceiptDetails = ({ receipt, scanning }) => {
  const rows = [
    { label: "Vendor", value: receipt.vendor, Icon: Store },
    { label: "Date", value: receipt.receiptDate, Icon: CalendarDays },
    { label: "Currency", value: receipt.currency, Icon: Coins },
  ].filter((r) => r.value);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle className="tracking-tight lg:text-base">Details</CardTitle>
        {rows.length > 0 && (
          <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] lg:inline">
            {rows.length} of 3 read
          </span>
        )}
      </div>
      <div className="mt-2 divide-y divide-[var(--border)] lg:mt-2.5">
        {rows.map(({ label, value, Icon }) => (
          <div key={label} className={ROW}>
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
        ))}

        {/* Fallback while scanned details are still empty */}
        {!scanning &&
          !receipt.vendor &&
          !receipt.receiptDate &&
          !receipt.currency && (
            <p className="mt-1 rounded-xl bg-[var(--surface-2)]/60 px-3 py-2 text-sm leading-relaxed text-[var(--ink-muted)] lg:px-3 lg:py-2.5">
              Couldn’t read vendor details — items are listed below.
            </p>
          )}

        {/* Skeleton while the scan is extracting */}
        {scanning && !receipt.vendor && !receipt.receiptDate && (
          <div className="space-y-1.5 pt-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <div className="h-7 w-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptDetails;
