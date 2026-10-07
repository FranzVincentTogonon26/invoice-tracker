import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, FileText, Loader2 } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/employeeDetailsTabs";
import { formatReceiptQty } from "@/lib/receiptMedia";
import { Button } from "../../../ui/Button";

const LineCells = ({ item, index }) => (
  <>
    <td className="px-4 py-3 align-top">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[10px] font-bold tabular-nums text-[var(--ink-muted)]"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium leading-snug text-[var(--ink)]">
            {item.description || "Unnamed item"}
          </p>
          {(item.quantity > 0 || item.rate > 0) && (
            <p className="mt-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
              {item.quantity ? `Qty: ${formatReceiptQty(item.quantity)}` : null}
              {item.quantity && item.rate ? " · " : null}
              {item.rate ? `@ ${formatMoney(item.rate)} each` : null}
            </p>
          )}
        </div>
      </div>
    </td>
    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-medium tabular-nums text-[var(--ink)]">
      {formatMoney(item.amount)}
    </td>
  </>
);

export function ExpenseLineItemsSection({
  lines,
  open,
  onToggle,
  loading,
  error,
  onRetry,
  refetching,
  regionId,
}) {
  if (loading) {
    return (
      <section
        aria-label="Receipt items"
        aria-busy="true"
        role="status"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="space-y-3 px-4 py-3">
          <div className="items-center gap-3 space-y-3">
            <span className="flex h-5 w-20 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <div className="flex h-3 flex-1 animate-pulse rounded-full bg-[var(--surface-2)]" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Receipt items"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Receipt items
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-[var(--danger)]/10 px-4 py-4">
          <AlertCircle
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--danger)]"
          />
          <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-[var(--danger)]">
            Couldn&apos;t load receipt items
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={refetching}
          >
            {refetching && (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            )}
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section
        aria-label="Receipt items"
        className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center"
      >
        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
          <FileText size={16} aria-hidden />
        </span>
        <p className="mt-2 text-xs font-medium text-[var(--ink)]">
          No itemized lines found
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
          This receipt didn&apos;t include itemized details.
        </p>
      </section>
    );
  }

  const itemsTotal = lines.reduce((sum, it) => sum + (it.amount || 0), 0);

  return (
    <section
      aria-label="Receipt items"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--ink)]">
              Scanned line items
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-normal text-[var(--ink-muted)]">
              {lines.length} {lines.length === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Total itemized:{" "}
            <span className="font-medium text-[var(--ink)]">
              {formatMoney(itemsTotal)}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] shadow-2xs">
          <span>{open ? "Hide items" : "Show items"}</span>
          <ChevronDown
            size={14}
            aria-hidden
            className={cn(
              "text-[var(--ink-muted)] transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="items-table-content"
            id={regionId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <div className="scrollbar-slim max-h-[260px] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                      Item description
                    </th>
                    <th className="w-[120px] px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60 bg-[var(--surface)]">
                  {lines.map((item, index) => (
                    <tr
                      key={item.key}
                      className="transition-colors hover:bg-[var(--surface-2)]/40"
                    >
                      <LineCells item={item} index={index} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-2.5 text-xs">
              <span className="text-[var(--ink-muted)]">
                Scanned line items total
              </span>
              <span className="font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(itemsTotal)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ExpenseLineItemsSection;
