import { Search } from "lucide-react";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";

// Dropdown filters in the toolbar — order defines layout order, `width` sets
// the dropdown width and `searchable` enables the in-dropdown search box.
const FILTER_DROPDOWNS = [
  {
    key: "employee",
    label: "All Employee",
    width: "w-[300px]",
    searchable: true,
  },
  { key: "method", label: "All methods", width: "w-[168px]" },
  { key: "fund", label: "All Source Funds", width: "w-[168px]" },
  { key: "status", label: "All Status", width: "w-[168px]" },
];

/**
 * Toolbar for the Budget Issued Transactions card: four connected dropdown
 * filters (employee · method · source fund · status) plus a search input.
 * Fully controlled — `filters`, `options`, `onFilterChange` and the search
 * value/handler are owned by the parent component.
 */
const IssuedTransactionFilters = ({
  filters,
  options,
  onFilterChange,
  search,
  onSearch,
}) => (
  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
    <div className="flex flex-wrap items-center gap-2">
      {FILTER_DROPDOWNS.map(({ key, label, width, searchable }) => (
        <div key={key} className={width}>
          <Listbox
            options={options[key] || []}
            value={filters[key]}
            onChange={(value) => onFilterChange(key, value)}
            placeholder={label}
            buttonClassName="h-9"
            searchable={Boolean(searchable)}
          />
        </div>
      ))}
    </div>
    <div className="lg:ml-auto lg:w-[320px]">
      <SearchInput
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search..."
        aria-label="Search issued transactions"
        leftIcon={<Search size={16} strokeWidth={2} />}
        className="w-full md:w-80"
      />
    </div>
  </div>
);

export default IssuedTransactionFilters;