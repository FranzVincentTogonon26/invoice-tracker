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
 * Open-only display: rows whose `status` is present and not 'open' (e.g. a
 * cut-off source) are never listed — a disconnected source connects to no
 * activity. Rows without a status field (older payloads, already filtered
 * server-side) still show.
 *
 * With `disablePastCutOff`, sources whose `date_cut_off` already passed
 * stay visible but cannot be picked (muted + tooltip) — used where a past
 * cut-off must hard-block the flow (e.g. adding new budget).
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
  disablePastCutOff = false,
}) => {
  const isCutOffDue = (dateCutOff) => {
    if (!disablePastCutOff || !dateCutOff) return false;
    const day = new Date(dateCutOff);
    if (Number.isNaN(day.getTime())) return false;
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day < today;
  };
  const options = references
    .filter((reference) => !reference.status || reference.status === "open")
    .map((reference) => {
      const pastDue = isCutOffDue(reference.date_cut_off);
      return {
        value: reference.reference_id,
        // Searchable text: the human label, falling back to the reference id
        label: reference.label || reference.reference_id,
        referenceId: reference.reference_id,
        createdAt: reference.created_at ?? reference.date_created,
        disabled: pastDue || undefined,
        disabledReason: pastDue
          ? "Cut-off date already due — this source accepts no new activity"
          : undefined,
      };
    });

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
          <span className="truncate font-sans text-xs tabular-nums tracking-tight">{`${(option.referenceId ?? "").slice(0, 8)}-xxxxx`}</span>
          {option.disabled && (
            <span className="shrink-0 rounded-full bg-[var(--danger)]/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--danger)]">
              Cut off due
            </span>
          )}
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
