import { cn } from "../../../../lib/utils";
import { TransactionCard, TransactionRow } from "./TransactionRow";

// Column proportions from the design spec: Description gets the most space
// because it holds the primary transaction information.
const COLUMN_WIDTHS = ["30%", "14%", "15%", "18%", "14%", "9%", "56px"];

const HEADERS = [
  { label: "Description" },
  { label: "Amount", align: "right" },
  { label: "Method" },
  { label: "Approved By" },
  { label: "Added / Approved" },
  { label: "Status" },
  { label: "Actions", srOnly: true, align: "right" },
];

/**
 * Budget transactions table.
 * Desktop: semantic `<table>` with a soft mint header, generous row padding
 * and horizontal scrolling when space is tight (keyboard/touch reachable).
 * Mobile: stacked transaction cards so nothing becomes unreadable.
 */
const TransactionTable = ({ rows, role, onAction }) => (
  <>
    {/* Desktop — semantic table with fixed column proportions */}
    <div
      className="hidden overflow-x-auto md:block rounded-xl border border-[var(--border)]"
      tabIndex={0}
      aria-label="Budget transactions"
    >
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
        <caption className="sr-only">
          Budget transactions with description, amount, payment method,
          approver, added and approved timestamps, and status
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
                  h.align === "right" && "text-right",
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
          {rows.map((t, i) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              role={role}
              onAction={onAction}
              // Open the menu upwards for the last rows so it never extends
              // past the bottom of the scroll container.
              openUp={i >= rows.length - 2}
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
        />
      ))}
    </div>
  </>
);

export default TransactionTable;
