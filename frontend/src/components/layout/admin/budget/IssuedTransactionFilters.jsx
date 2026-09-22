import { Flag, HandCoins, Search, Users, Wallet } from "lucide-react";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";
import { MethodIcon } from "../../../ui/Select";
import { STATUS } from "../../../../constants";
import { cn } from "../../../../lib/utils";

const FILTER_DROPDOWNS = [
  {
    key: "employee",
    label: "All Employee",
    width: "w-full sm:w-[calc(50%-4px)] xl:w-[280px]",
    searchable: true,
  },
  {
    key: "method",
    label: "All methods",
    width: "w-full sm:w-[calc(50%-4px)] xl:w-[176px]",
  },
  {
    key: "fund",
    label: "All Source Funds",
    width: "w-full sm:w-[calc(50%-4px)] xl:w-[188px]",
  },
  {
    key: "status",
    label: "All Status",
    width: "w-full sm:w-[calc(50%-4px)] xl:w-[168px]",
  },
];
const FILTER_PLACEHOLDER_ICON = {
  employee: Users,
  method: Wallet,
  fund: HandCoins,
  status: Flag,
};

function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function FilterAvatar({ name, avatarUrl, size = "h-7 w-7 text-xs" }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]",
          size,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]",
        size,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

const STATUS_DOT = {
  accent: "bg-[var(--accent)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  neutral: "bg-[var(--ink-muted)]",
};

function StatusDot({ statusValue, className }) {
  const tone = STATUS[statusValue]?.tone ?? "neutral";
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        STATUS_DOT[tone] ?? STATUS_DOT.neutral,
        className,
      )}
    />
  );
}

function FilterTrigger({ filterKey, label, selectedOption }) {
  const PlaceholderIcon = FILTER_PLACEHOLDER_ICON[filterKey];
  if (selectedOption) {
    if (filterKey === "employee") {
      return (
        <span className="flex min-w-0 items-center gap-2">
          <FilterAvatar
            name={selectedOption.label}
            avatarUrl={selectedOption.avatar_url}
          />
          <span className="truncate text-sm text-[var(--ink-muted)] font-semibold">
            {selectedOption.label}
          </span>
        </span>
      );
    }
    if (filterKey === "method") {
      return (
        <span className="flex min-w-0 items-center gap-2">
          <MethodIcon method={selectedOption.value} />
          <span className="truncate text-sm text-[var(--ink-muted)] font-semibold">
            {selectedOption.label}
          </span>
        </span>
      );
    }
    if (filterKey === "fund") {
      return (
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <HandCoins size={13} aria-hidden />
          </span>
          <span className="truncate text-sm text-[var(--ink-muted)] font-semibold">
            {selectedOption.label}
          </span>
        </span>
      );
    }
    return (
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot statusValue={selectedOption.value} />
        <span className="truncate text-sm text-[var(--ink-muted)] font-semibold">
          {selectedOption.label}
        </span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2 text-[var(--ink-muted)]">
      <PlaceholderIcon size={15} aria-hidden className="shrink-0" />
      <span className="truncate  text-xs">{label}</span>
    </span>
  );
}

function FilterOption({ filterKey, option, selected }) {
  if (filterKey === "employee") {
    return (
      <>
        <FilterAvatar name={option.label} avatarUrl={option.avatar_url} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{option.label}</span>
          {option.employee_role && (
            <span className="block truncate text-xs capitalize text-[var(--ink-muted)]">
              {option.employee_role}
            </span>
          )}
        </span>
      </>
    );
  }
  if (filterKey === "method") {
    return (
      <>
        <MethodIcon
          method={option.value}
          className={cn(selected && "text-[var(--accent-strong)]")}
        />
        <span className="truncate flex-1">{option.label}</span>
      </>
    );
  }
  if (filterKey === "fund") {
    return (
      <>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            selected
              ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              : "bg-[var(--surface-2)] text-[var(--ink-muted)]",
          )}
        >
          <HandCoins size={13} aria-hidden />
        </span>
        <span className="truncate flex-1">{option.label}</span>
      </>
    );
  }
  return (
    <>
      <StatusDot statusValue={option.value} />
      <span className="truncate flex-1">{option.label}</span>
    </>
  );
}

const IssuedTransactionFilters = ({
  filters,
  options,
  onFilterChange,
  search,
  onSearch,
}) => (
  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
    <div
      role="group"
      aria-label="Issued transaction filters"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      {FILTER_DROPDOWNS.map(({ key, label, width, searchable }) => (
        <div key={key} className={width}>
          <Listbox
            options={options[key] || []}
            value={filters[key]}
            onChange={(value) => onFilterChange(key, value)}
            placeholder={label}
            searchable={Boolean(searchable)}
            renderTrigger={(selectedOption) => (
              <FilterTrigger
                filterKey={key}
                label={label}
                selectedOption={selectedOption}
              />
            )}
            renderOption={(option, { selected }) => (
              <FilterOption
                filterKey={key}
                option={option}
                selected={selected}
              />
            )}
          />
        </div>
      ))}
    </div>
    <div className="lg:ml-auto lg:w-[320px]">
      <SearchInput
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search employee, notes..."
        aria-label="Search issued transactions"
        leftIcon={<Search size={16} strokeWidth={2} />}
        className="h-9 w-full"
      />
    </div>
  </div>
);

export default IssuedTransactionFilters;
