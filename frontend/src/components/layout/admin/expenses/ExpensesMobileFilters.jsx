import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { FilterSheet, FilterSheetField } from "../../../ui/MobileFilters";
import Listbox from "../../../ui/Listbox";

// The Listboxes' "no filter" value, matching the leading "All …" option.
const DEFAULTS = { category: "all", method: "all", status: "all" };

/**
 * Mobile counterpart of AdminExpenses' inline filter row (rendered below `lg`
 * only — the trigger button and this sheet are both `lg:hidden`, so tablet and
 * desktop keep the exact same inline Listbox row they had).
 *
 * The sheet stages the three dropdowns and only hands them back through
 * `onApply` when the admin confirms, which makes the footer buttons real:
 * "Reset" rewinds the draft, "Show N results" commits it. `countMatches` lets
 * the page print the live row count for the staged draft, so a choice is never
 * a guess.
 */
const ExpensesMobileFilters = ({
  open,
  onClose,
  category,
  method,
  status,
  categoryOptions,
  methodOptions,
  statusOptions,
  onApply,
  onClearAll,
  countMatches,
  totalRows = 0,
  hasActiveFilters = false,
}) => {
  const [draft, setDraft] = useState({ category, method, status });

  // Every open starts from what is actually applied — a dismissed sheet never
  // leaves half-made choices behind. Adjusting state during render is the
  // documented alternative to a setState-in-effect (same pattern as
  // AdminShell's palette reset) and it also keeps the draft honest if the page
  // clears its filters while the sheet is open.
  const appliedKey = `${open}|${category}|${method}|${status}`;
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    if (open) setDraft({ category, method, status });
  }

  const draftIsDefault =
    draft.category === DEFAULTS.category &&
    draft.method === DEFAULTS.method &&
    draft.status === DEFAULTS.status;

  const total = Number.isFinite(totalRows) ? totalRows : 0;
  const matchCount = countMatches ? countMatches(draft) : total;

  const handleApply = () => {
    onApply?.(draft);
    onClose?.();
  };

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title="Filters"
      description="Narrow the ledger by category, method or status."
      draftIsDefault={draftIsDefault}
      matchCount={matchCount}
      totalRows={total}
      hasActiveFilters={hasActiveFilters}
      onReset={() => setDraft({ ...DEFAULTS })}
      onPrimary={handleApply}
      bodyAction={
        /* Escape hatch for the filters that live outside this sheet. */
        hasActiveFilters ? (
          <button
            type="button"
            onClick={() => onClearAll?.()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            <RotateCcw size={13} aria-hidden />
            Clear filters, search and date range
          </button>
        ) : null
      }
    >
      <FilterSheetField label="Category">
        <Listbox
          options={categoryOptions}
          value={draft.category}
          onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
          placeholder="All categories"
        />
      </FilterSheetField>

      <FilterSheetField label="Method">
        <Listbox
          options={methodOptions}
          value={draft.method}
          onChange={(v) => setDraft((d) => ({ ...d, method: v }))}
          placeholder="All methods"
        />
      </FilterSheetField>

      <FilterSheetField label="Status">
        <Listbox
          options={statusOptions}
          value={draft.status}
          onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
          placeholder="All status"
        />
      </FilterSheetField>
    </FilterSheet>
  );
};

export default ExpensesMobileFilters;
