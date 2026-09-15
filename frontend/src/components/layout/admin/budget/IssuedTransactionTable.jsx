import { cn } from "../../../../lib/utils";
import {
  IssuedTransactionCard,
  IssuedTransactionRow,
} from "./IssuedTransactionRow";

// Column proportions from the design spec — Employee gets the most space
// because it anchors the row. Percentages sum to 100% so `table-fixed` never
// overflows the scroll container (sizing verified against the 960px min-width).
const COLUMN_WIDTHS = ["13%", "10%", "8%", "6%", "7%", "10%", "7%", "6%", "5%"];

const HEADERS = [
  { label: "Employee" },
  { label: "Description" },
  { label: "Source" },
  { label: "Amount", align: "right" },
  { label: "Method" },
  { label: "Notes" },
  { label: "Date Issued" },
  { label: "Status", align: "center" },
  { label: "Actions", srOnly: true },
];

/**
 * Budget issued transactions table.
 * Desktop: semantic `<table>` with a soft mint header, generous row padding
 * and horizontal scrolling when space is tight (keyboard/touch reachable).
 * Mobile: stacked transaction cards so nothing becomes unreadable.
 */
export function IssuedTransactionTable({ rows, onAction }) {
  return (
    <>
      {/* Desktop — semantic table with fixed column proportions */}
      <div
        className="hidden overflow-x-auto overflow-y-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
        tabIndex={0}
        aria-label="Budget issued transactions"
      >
        <div className="relative min-w-[960px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          {/* Accent hairline running along the top edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)/65,transparent)]"
          />
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Budget issued transactions with employee, description, notes,
              amount, payment method, source of funds, date issued, and status
            </caption>
            <colgroup>
              {COLUMN_WIDTHS.map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-[var(--surface-2)]/60">
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={cn(
                      "border-b border-[var(--border)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] first:pl-5 last:pr-5",
                      {
                        "text-left": h.align === "left",
                        "text-center": h.align === "center",
                        "text-right": h.align === "right",
                      },
                    )}
                  >
                    <span
                      className={h.srOnly ? "sr-only" : "whitespace-nowrap"}
                    >
                      {h.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <IssuedTransactionRow
                  key={t.id}
                  transaction={t}
                  onAction={onAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile — stacked transaction cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((t) => (
          <IssuedTransactionCard
            key={t.id}
            transaction={t}
            onAction={onAction}
          />
        ))}
      </div>
    </>
  );
}

export default IssuedTransactionTable;