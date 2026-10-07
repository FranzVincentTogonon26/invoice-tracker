import { Search, SlidersHorizontal, X } from "lucide-react";
import { SearchInput } from "../../../ui/Input";
import { IconButton } from "../../../ui/IconButton";
import Listbox from "../../../ui/Listbox";
import { DateRangePicker } from "../../../ui/DateRangePicker";
import { FilterChips } from "../../../ui/MobileFilters";
import { cn } from "@/lib/utils";
import { EXPENSE_FILTER_KEYS } from "@/constants";
import { employeeListboxProps } from "./EmployeeFilter";
import ExpensesMobileFilters from "./ExpensesMobileFilters";

export function ExpenseFilterBar({
  search,
  onSearch,
  dateRange,
  onDateRange,
  filters,
  onFilterChange,
  options,
  chips,
  onClearAllFilters,
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
        placeholder="Search..."
        aria-label="Search expenses"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="h-11 min-w-0 flex-1 sm:h-10"
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
    switch (key) {
      case "employee":
        return (
          <Listbox
            portal
            options={options.employee}
            value={filters.employee}
            onChange={(v) => onFilterChange("employee", v)}
            placeholder="All Employee"
            {...employeeListboxProps("All Employee")}
          />
        );

      case "category":
        return (
          <Listbox
            portal
            options={options.category}
            value={filters.category}
            onChange={(v) => onFilterChange("category", v)}
            placeholder="All categories"
          />
        );

      case "method":
        return (
          <Listbox
            portal
            options={options.method}
            value={filters.method}
            onChange={(v) => onFilterChange("method", v)}
            placeholder="All methods"
          />
        );

      case "status":
        return (
          <Listbox
            portal
            options={options.status}
            value={filters.status}
            onChange={(v) => onFilterChange("status", v)}
            placeholder="All status"
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="flex items-center gap-2 xl:hidden">
          <div className="min-w-0 flex-1">{searchField}</div>

          <IconButton
            type="button"
            title="Filter"
            aria-label={mobileFiltersLabel}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={onOpenFilters}
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
            and always visible, columns just reflow (4 → 2) as the card
            narrows. No measuring, no sliding track, no translateX, so
            resizing can never flash a horizontal scrollbar or shuffle
            which filters are on screen. Same records stay mounted. */}
        <div
          role="group"
          aria-label="Expense filters"
          className="hidden min-w-0 flex-1 grid-cols-4 gap-2 xl:grid 2xl:gap-2.5"
        >
          {EXPENSE_FILTER_KEYS.map((key) => (
            <div key={key} className="min-w-0">
              {renderFilter(key)}
            </div>
          ))}
        </div>

        {/* Mid widths (lg–xl): filters get their own full-width row above
            search so nothing squeezes into a shrunken sliding window. */}
        <div
          role="group"
          aria-label="Expense filters"
          className="hidden min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid xl:hidden"
        >
          {EXPENSE_FILTER_KEYS.map((key) => (
            <div key={key} className="min-w-0">
              {renderFilter(key)}
            </div>
          ))}
        </div>

        <div className="hidden min-w-0 xl:ml-auto xl:block xl:w-[420px] xl:shrink-0 2xl:w-[480px]">
          {searchField}
        </div>
      </div>

      <FilterChips chips={chips} onClearAll={onClearAllFilters} />

      <ExpensesMobileFilters
        open={filtersOpen}
        onClose={() => onOpenFilters(false)}
        employee={filters.employee}
        category={filters.category}
        method={filters.method}
        status={filters.status}
        employeeOptions={options.employee}
        categoryOptions={options.category}
        methodOptions={options.method}
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

export default ExpenseFilterBar;
