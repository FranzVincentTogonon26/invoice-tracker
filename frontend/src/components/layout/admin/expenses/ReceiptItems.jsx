import { Plus, Trash2 } from "lucide-react";
import { Input } from "../../../ui/Input";
import { CardTitle } from "../../../ui/Card";
import { formatMoney } from "../../../../lib/utils";

const GRID_COLS = "grid-cols-[minmax(350px,1fr)_64px_96px_80px_36px]";
const GRID_COLS_SM = "sm:grid-cols-[minmax(320px,1fr)_64px_96px_112px_36px]";

const ItemRow = ({ item, index, onItemChange, onRemove }) => {
  const quantity = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const amount = quantity * rate;

  return (
    <>
      <div
        className={`hidden ${GRID_COLS} items-center gap-x-3 px-2 py-1.5 sm:grid lg:gap-x-4 lg:px-3 lg:py-2`}
      >
        <div className="min-w-0">
          <Input
            className="h-9 w-full min-w-0 rounded-lg px-2.5 text-[13px]"
            value={item.description}
            placeholder="Item description"
            inputMode="text"
            autoComplete="off"
            aria-label={`Description for line ${index + 1}`}
            onChange={(e) =>
              onItemChange(index, { description: e.target.value })
            }
          />
        </div>
        <div className="min-w-0">
          <Input
            className="h-9 w-full rounded-lg px-2 text-center tabular text-[13px]"
            type="number"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label={`Quantity for line ${index + 1}`}
            value={item.quantity}
            onChange={(e) => onItemChange(index, { quantity: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <Input
            className="h-9 w-full rounded-lg px-2.5 text-right tabular text-[13px]"
            type="number"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-label={`Rate for line ${index + 1}`}
            value={item.rate}
            onChange={(e) => onItemChange(index, { rate: e.target.value })}
          />
        </div>
        <div className="min-w-0 text-right">
          <span className="text-[13px] font-semibold tabular text-[var(--ink)]">
            {formatMoney(amount)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-8 w-8 items-center justify-center justify-self-end rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] active:bg-[var(--danger)]/10 active:text-[var(--danger)]"
          title="Remove line"
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2.5 px-2 py-2 sm:hidden">
        <div className="min-w-0 flex-1">
          <Input
            className="h-8 w-full min-w-0 rounded-lg border-0 bg-transparent px-0 text-[13px] font-medium shadow-none focus:ring-0"
            value={item.description}
            placeholder="Item description"
            inputMode="text"
            autoComplete="off"
            aria-label={`Description for line ${index + 1}`}
            onChange={(e) =>
              onItemChange(index, { description: e.target.value })
            }
          />
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
            <span>Qty</span>
            <Input
              className="h-5 w-10 rounded border-0 bg-transparent p-0 text-[11px] tabular shadow-none focus:ring-0"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              aria-label={`Quantity for line ${index + 1}`}
              value={item.quantity}
              onChange={(e) =>
                onItemChange(index, { quantity: e.target.value })
              }
            />
            <span className="text-[var(--border)]">×</span>
            <Input
              className="h-5 w-16 rounded border-0 bg-transparent p-0 text-[11px] tabular shadow-none focus:ring-0"
              type="number"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-label={`Rate for line ${index + 1}`}
              value={item.rate}
              onChange={(e) => onItemChange(index, { rate: e.target.value })}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[13px] font-semibold tabular text-[var(--ink)]">
            {formatMoney(amount)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] active:bg-[var(--danger)]/10 active:text-[var(--danger)]"
          title="Remove line"
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </>
  );
};

const ReceiptItems = ({
  items,
  scanning,
  onItemChange,
  onRemoveItem,
  onAddItem,
  itemsTotal,
}) => (
  <div>
    <div className="flex items-center justify-between gap-3">
      <CardTitle className="tracking-tight lg:text-[17px]">
        Scan list items
      </CardTitle>
      {items.length > 0 && !scanning && (
        <span className="text-[11px] font-medium tabular text-[var(--ink-muted)]">
          {items.length} {items.length === 1 ? "line" : "lines"}
        </span>
      )}
    </div>

    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] sm:mt-2.5">
      <div
        className={`hidden ${GRID_COLS} items-center gap-x-3 border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)] sm:grid lg:gap-x-4 lg:px-3 lg:py-2`}
      >
        <span>Description</span>
        <span className="text-center">Qty</span>
        <span className="text-center">Rate</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {scanning && !items.length && (
        <div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-b border-[var(--border)] px-2 py-2 last:border-b-0 sm:px-2 sm:py-2 lg:px-3"
            >
              <div
                className={`hidden ${GRID_COLS_SM} items-center gap-x-3 sm:grid lg:gap-x-4`}
              >
                <div className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]" />
                <div className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]" />
                <div className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]" />
                <div className="h-6 animate-pulse rounded-md bg-[var(--surface-2)]" />
                <div className="h-7 w-7 animate-pulse rounded-md bg-[var(--surface-2)]" />
              </div>
              <div className="flex items-center gap-3 sm:hidden">
                <div className="min-w-0 flex-1">
                  <div className="h-7 animate-pulse rounded-md bg-[var(--surface-2)]" />
                  <div className="mt-1.5 h-4 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
                <div className="h-5 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-7 w-7 animate-pulse rounded-md bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div>
          {items.map((item, i) => (
            <div
              key={i}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <ItemRow
                item={item}
                index={i}
                onItemChange={onItemChange}
                onRemove={onRemoveItem}
              />
            </div>
          ))}
        </div>
      )}

      {!scanning && items.length === 0 && (
        <div className="px-3 py-4 text-center sm:py-4">
          <p className="text-[13px] font-medium text-[var(--ink)]">
            No line items yet
          </p>
          <p className="mx-auto mt-0.5 max-w-sm text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Add a line manually or re-scan the receipt.
          </p>
        </div>
      )}

      {!scanning && (
        <button
          type="button"
          onClick={onAddItem}
          className="flex min-h-[36px] w-full items-center justify-center gap-1.5 border-t border-dashed border-[var(--border)] px-3 py-2 text-[13px] font-medium text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]/40 active:bg-[var(--accent-soft)]/50"
        >
          <Plus size={14} />
          Add line item
        </button>
      )}
    </div>

    <div className="mt-2 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-2 sm:mt-2.5 sm:pt-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
        Total amount
      </span>
      <span className="font-display text-[17px] font-semibold tabular text-[var(--ink)] sm:text-lg">
        {formatMoney(itemsTotal)}
      </span>
    </div>
  </div>
);

export default ReceiptItems;
