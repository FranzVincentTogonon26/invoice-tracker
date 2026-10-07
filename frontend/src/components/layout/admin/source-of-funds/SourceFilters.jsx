import { Search } from "lucide-react";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";
import { SOURCE_STATUS_OPTIONS } from "@/constants";

export function SourceFilters({ search, onSearchChange, status, onStatusChange }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="w-full lg:max-w-[200px]">
        <Listbox
          options={SOURCE_STATUS_OPTIONS}
          value={status}
          onChange={onStatusChange}
          placeholder="All statuses"
        />
      </div>
      <div className="lg:ml-auto lg:w-[320px]">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search label or notes…"
          aria-label="Search sources"
          leftIcon={<Search size={16} />}
        />
      </div>
    </div>
  );
}

export default SourceFilters;
