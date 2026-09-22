import { Check, HandCoins } from "lucide-react";
import Listbox from "./Listbox";
import { formatDate } from "../../lib/utils";

/**
 * Reference-ID dropdown built on the generic `Listbox`.
 *
 * `references` are budget_reference rows — `{ reference_id, label, created_at }`
 * (a DB TIMESTAMPTZ). Legacy rows that only carry a `date_created` string are
 * still supported. The selected `value` is a `reference_id` — keys/selection
 * must never use `created_at`.
 *
 * Row layout: leading accent-soft calendar chip, the human `label` as the
 * primary line, and the date + mono `reference_id` as muted metadata.
 */
export const SelectReference = ({
  references = [],
  value,
  onChange,
  placeholder,
  disabled,
  searchable = true,
}) => {
  const options = references.map((reference) => ({
    value: reference.reference_id,
    // Searchable text: the human label, falling back to the reference id
    label: reference.label || reference.reference_id,
    referenceId: reference.reference_id,
    createdAt: reference.created_at ?? reference.date_created,
  }));

  const renderOption = (option, { selected: isSelected }) => (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <HandCoins size={13} aria-hidden />
      </span>
      <span className="flex-1 min-w-0 space-y-0.5">
        <span className="block truncate text-sm font-medium">
          {option.label}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <span className="shrink-0 tabular-nums">
            {formatDate(option.createdAt)}
          </span>
          <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-current opacity-60" />
          <span className="truncate font-mono text-xs tracking-tight">{`${(option.referenceId ?? "").slice(0, 8)}-xxxxx`}</span>
        </span>
      </span>
      {isSelected && (
        <Check size={14} className="shrink-0 text-[var(--accent-strong)]" />
      )}
    </>
  );

  return (
    <Listbox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select source"}
      disabled={disabled}
      searchable={searchable}
      renderTrigger={(selectedOption) =>
        selectedOption ? (
          <span className="flex min-w-0 items-center gap-2">
            <HandCoins
              size={14}
              aria-hidden
              className="shrink-0 text-[var(--ink-muted)]"
            />
            <span className="truncate">{selectedOption.label}</span>
            <span className="shrink-0 text-xs text-[var(--ink-muted)]">
              {formatDate(selectedOption.createdAt)}
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2 text-[var(--ink-muted)]">
            <HandCoins size={14} aria-hidden className="shrink-0" />
            <span className="truncate">{placeholder || "Select source"}</span>
          </span>
        )
      }
      renderOption={renderOption}
    />
  );
};

SelectReference.displayName = "SelectReference";

export default SelectReference;
