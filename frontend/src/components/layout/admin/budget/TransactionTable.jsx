import { cn } from "../../../../lib/utils";
import { TransactionCard, TransactionRow } from "./TransactionRow";

// Column proportions from the design spec: Description gets the most space
// because it holds the primary transaction information. The percentages sum to
// exactly 100% so `table-fixed` never overflows the scroll container — sizing
// verified against the table's 900px min-width.
const COLUMN_WIDTHS = ["27%", "11%", "13%", "18%", "13%", "10%", "5%"];

const HEADERS = [
  { label: "Description" },
  { label: "Amount", align: "right" },
  { label: "Payment" },
  { label: "Approved By" },
  { label: "Date Added" },
  { label: "Status", align: "center" },
  { label: "Actions", srOnly: true, align: "right" },
];

/**
 * Budget transactions table.
 * Desktop: semantic `<table>` with a soft mint header, generous row padding
 * and horizontal scrolling when space is tight (keyboard/touch reachable).
 * Mobile: stacked transaction cards so nothing becomes unreadable.
 */
const TransactionTable = ({ rows, role, onAction, valueRemaining }) => (
  <>
    {/* Desktop — semantic table with fixed column proportions */}
    <div
      className="hidden overflow-x-auto rounded-xl border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
      tabIndex={0}
      aria-label="Budget transactions"
    >
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
        <caption className="sr-only">
          Budget transactions with description, amount, payment method,
          approver, date added, and status
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
                  "border-b border-[var(--border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] first:pl-5 last:pr-5",
                  {
                    "text-left": h.align === "left",
                    "text-center": h.align === "center",
                    "text-right": h.align === "right",
                  },
                )}
              >
                {h.srOnly ? (
                  <span className="sr-only">{h.label}</span>
                ) : (
                  <span className="whitespace-nowrap">{h.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              role={role}
              onAction={onAction}
              valueRemaining={valueRemaining}
            />
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile — stacked transaction cards */}
    <div className="flex flex-col gap-2.5 md:hidden">
      {rows.map((t) => (
        <TransactionCard
          key={t.id}
          transaction={t}
          role={role}
          onAction={onAction}
          valueRemaining={valueRemaining}
        />
      ))}
    </div>
  </>
);

export default TransactionTable;
