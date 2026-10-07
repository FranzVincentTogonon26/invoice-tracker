import {
  ArrowLeftRight,
  ClipboardList,
  HandCoins,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { SearchInput } from "../../../ui/Input";
import { IconButton } from "../../../ui/IconButton";
import Listbox from "../../../ui/Listbox";
import { DateRangePicker } from "../../../ui/DateRangePicker";
import { FilterChips } from "../../../ui/MobileFilters";
import { Tabs, TabsList, TabsTrigger } from "../../../ui/Tabs";
import { cn } from "@/lib/utils";
import { TRANSACTION_FILTER_KEYS } from "@/constants";
import TransactionsMobileFilters from "./TransactionsMobileFilters";

export const TYPE_TABS = [
  { value: "all", label: "All", Icon: ClipboardList },
  { value: "budget", label: "Budget Given", Icon: Plus },
  { value: "issued", label: "Budget Issued", Icon: HandCoins },
  { value: "expense", label: "Expenses", Icon: ReceiptText },
  { value: "abono", label: "Abono", Icon: Wallet },
  { value: "transfer", label: "Transfers", Icon: ArrowLeftRight },
];

export function TransactionFilterBar({
  tab,
  onTabChange,
  search,
  onSearch,
  dateRange,
  onDateRange,
  filters,
  onFilterChange,
  options,
  chips,
  onClearAllChips,
  filtersOpen,
  onOpenFilters,
  mobileFiltersLabel,
  countMatches,
  totalRows,
  hasActiveFilters,
  onApplyMobile,
  onClearMobile,
}) {
  const searchField = (
    <div className="flex w-full items-center gap-2">
      <SearchInput
        leftIcon={<Search size={16} />}
        placeholder="Search transactions…"
        aria-label="Search transactions"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="min-w-0 flex-1"
        rightSlot={
          search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          ) : null
        }
      />
      <DateRangePicker
        value={dateRange}
        onChange={onDateRange}
        placeholder="All dates"
        align="end"
        compactOnMobile
      />
    </div>
  );

  const renderFilter = (key) => {
    const shared = { portal: true };
    switch (key) {
      case "direction":
        return (
          <Listbox
            {...shared}
            options={options.direction}
            value={filters.direction}
            onChange={(v) => onFilterChange("direction", v)}
            placeholder="All flows"
          />
        );
      case "employee":
        return (
          <Listbox
            {...shared}
            searchable
            options={options.employee}
            value={filters.employee}
            onChange={(v) => onFilterChange("employee", v)}
            placeholder="All employees"
          />
        );
      case "reference":
        return (
          <Listbox
            {...shared}
            searchable
            options={options.reference}
            value={filters.reference}
            onChange={(v) => onFilterChange("reference", v)}
            placeholder="All references"
          />
        );
      case "category":
        return (
          <Listbox
            {...shared}
            options={options.category}
            value={filters.category}
            onChange={(v) => onFilterChange("category", v)}
            placeholder="All categories"
          />
        );
      case "status":
        return (
          <Listbox
            {...shared}
            options={options.status}
            value={filters.status}
            onChange={(v) => onFilterChange("status", v)}
            placeholder="All statuses"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="mb-4">
          <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto">
            {TYPE_TABS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="grow px-3 sm:grow-0 sm:px-4"
              >
                <Icon
                  size={13}
                  aria-hidden
                  className="hidden shrink-0 sm:block"
                />
                <span className="whitespace-nowrap text-xs font-medium">
                  {label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-start">
        <div className="flex items-center gap-2 2xl:hidden">
          <div className="min-w-0 flex-1">{searchField}</div>
          <IconButton
            type="button"
            aria-label={mobileFiltersLabel}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => onOpenFilters(true)}
            className={cn(
              "shrink-0 sm:h-10 sm:w-10",
              chips.length > 0 &&
                "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-strong)]",
            )}
          >
            <SlidersHorizontal size={16} aria-hidden />
            {chips.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-normal leading-none text-white ring-2 ring-[var(--surface)]">
                {chips.length}
              </span>
            )}
          </IconButton>
        </div>
        {/* Desktop filters — pure CSS grid: every filter is always mounted
            and always visible, columns just reflow as the card narrows. No
            measuring, no sliding track, no translateX, so resizing can never
            flash a horizontal scrollbar or shuffle which filters are on
            screen. Same records stay mounted. */}
        <div
          role="group"
          aria-label="Transaction filters"
          className="hidden min-w-0 flex-1 grid-cols-5 gap-2 2xl:grid"
        >
          {TRANSACTION_FILTER_KEYS.map((key) => (
            <div key={key} className="min-w-0">
              {renderFilter(key)}
            </div>
          ))}
        </div>

        {/* Mid widths (lg–2xl): filters get their own full-width row above
            search so nothing squeezes into a shrunken sliding window. */}
        <div
          role="group"
          aria-label="Transaction filters"
          className="hidden min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid xl:grid-cols-5 2xl:hidden"
        >
          {TRANSACTION_FILTER_KEYS.map((key) => (
            <div key={key} className="min-w-0">
              {renderFilter(key)}
            </div>
          ))}
        </div>
        <div className="hidden min-w-0 2xl:ml-auto 2xl:block 2xl:w-[420px] 2xl:shrink-0">
          {searchField}
        </div>
      </div>
      <FilterChips chips={chips} onClearAll={onClearAllChips} />
      <TransactionsMobileFilters
        open={filtersOpen}
        onClose={() => onOpenFilters(false)}
        type={tab}
        direction={filters.direction}
        employee={filters.employee}
        reference={filters.reference}
        category={filters.category}
        status={filters.status}
        typeOptions={options.type}
        directionOptions={options.direction}
        employeeOptions={options.employee}
        referenceOptions={options.reference}
        categoryOptions={options.category}
        statusOptions={options.status}
        onApply={onApplyMobile}
        onClearAll={onClearMobile}
        countMatches={countMatches}
        totalRows={totalRows}
        hasActiveFilters={hasActiveFilters}
      />
    </>
  );
}

export default TransactionFilterBar;
