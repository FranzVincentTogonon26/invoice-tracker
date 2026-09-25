import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { FilterSheet, FilterSheetField } from "../../../ui/MobileFilters";
import Listbox from "../../../ui/Listbox";

// Every dropdown's "no filter" value (the leading "All …" option).
const ALL = "all";

/**
 * Mobile counterpart of `IssuedTransactionFilters`' inline dropdown row —
 * rendered below `lg` only (the page's trigger button and this sheet are both
 * `lg:hidden`, so tablet and desktop keep the exact same inline row they had).
 *
 * The sheet stages a draft of the dropdowns and only hands it back through
 * `onApply` when the admin confirms, which is what makes the footer buttons
 * real: "Reset" rewinds the draft, "Show N results" commits it. `countMatches`
 * lets the page report how many rows that draft would return, so a choice is
 * never a guess.
 *
 * The desktop trigger/option visuals arrive as `Trigger`/`Option` so avatars,
 * method icons and status dots stay identical in both places.
 */
const IssuedTransactionMobileFilters = ({
  open,
  onClose,
  filters,
  options,
  fields,
  Trigger,
  Option,
  onApply,
  onClearAll,
  countMatches,
  totalRows = 0,
  hasActiveFilters = false,
}) => {
  const [draft, setDraft] = useState(() => ({ ...filters }));

  // Every open starts from what is actually applied — a dismissed sheet never
  // leaves half-made choices behind. Adjusting state during render is the
  // documented alternative to a setState-in-effect (same pattern as
  // AdminShell's palette reset) and it also keeps the draft honest if the page
  // clears its filters while the sheet is open.
  const appliedKey = `${open}|${fields
    .map(({ key }) => filters[key])
    .join("|")}`;
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    if (open) setDraft({ ...filters });
  }

  const draftIsDefault = fields.every(({ key }) => draft[key] === ALL);
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
      description="Narrow the issued transactions by employee, method, fund or status."
      draftIsDefault={draftIsDefault}
      matchCount={matchCount}
      totalRows={total}
      hasActiveFilters={hasActiveFilters}
      onReset={() =>
        setDraft(Object.fromEntries(fields.map(({ key }) => [key, ALL])))
      }
      onPrimary={handleApply}
      bodyAction={
        /* Escape hatch for the search box, which lives outside this sheet. */
        hasActiveFilters ? (
          <button
            type="button"
            onClick={() => onClearAll?.()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            <RotateCcw size={13} aria-hidden />
            Clear filters and search
          </button>
        ) : null
      }
    >
      {fields.map(({ key, label, sheetLabel, searchable }) => (
        <FilterSheetField key={key} label={sheetLabel}>
          <Listbox
            options={options[key] || []}
            value={draft[key]}
            onChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
            placeholder={label}
            searchable={Boolean(searchable)}
            renderTrigger={(selectedOption) => (
              <Trigger
                filterKey={key}
                label={label}
                selectedOption={selectedOption}
              />
            )}
            renderOption={(option, { selected }) => (
              <Option filterKey={key} option={option} selected={selected} />
            )}
          />
        </FilterSheetField>
      ))}
    </FilterSheet>
  );
};

export default IssuedTransactionMobileFilters;
