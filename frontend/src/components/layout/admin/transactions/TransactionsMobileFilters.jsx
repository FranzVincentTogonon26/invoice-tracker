import { useEffect, useState } from "react";
import Listbox from "../../../ui/Listbox";
import {
  FilterSheet,
  FilterSheetField,
} from "../../../ui/MobileFilters";

// Mobile bottom sheet for the unified ledger filters. The caller owns the
// committed values; the sheet stages a draft, previews how many rows it would
// match (`countMatches`), and only commits on "Show N results" — Reset rewinds
// the draft to the all-default state.
const TransactionsMobileFilters = ({
  open,
  onClose,
  type,
  direction,
  employee,
  reference,
  category,
  status,
  typeOptions,
  directionOptions,
  employeeOptions,
  referenceOptions,
  categoryOptions,
  statusOptions,
  onApply,
  onClearAll,
  countMatches,
  totalRows,
  hasActiveFilters,
}) => {
  const [draftType, setDraftType] = useState(type);
  const [draftDirection, setDraftDirection] = useState(direction);
  const [draftEmployee, setDraftEmployee] = useState(employee);
  const [draftReference, setDraftReference] = useState(reference);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftStatus, setDraftStatus] = useState(status);

  useEffect(() => {
    if (!open) return;
    setDraftType(type);
    setDraftDirection(direction);
    setDraftEmployee(employee);
    setDraftReference(reference);
    setDraftCategory(category);
    setDraftStatus(status);
  }, [open, type, direction, employee, reference, category, status]);

  const draft = {
    type: draftType,
    direction: draftDirection,
    employee: draftEmployee,
    reference: draftReference,
    category: draftCategory,
    status: draftStatus,
  };

  const draftIsDefault =
    draftType === "all" &&
    draftDirection === "all" &&
    draftEmployee === "all" &&
    draftReference === "all" &&
    draftCategory === "all" &&
    draftStatus === "all";

  const resetDraft = () => {
    setDraftType("all");
    setDraftDirection("all");
    setDraftEmployee("all");
    setDraftReference("all");
    setDraftCategory("all");
    setDraftStatus("all");
  };

  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title="Filter transactions"
      description="Narrow the ledger by type, money flow, people and more."
      draftIsDefault={draftIsDefault}
      matchCount={countMatches(draft)}
      totalRows={totalRows}
      hasActiveFilters={hasActiveFilters}
      onReset={() => {
        resetDraft();
        onClearAll?.();
      }}
      onPrimary={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterSheetField label="Transaction type">
        <Listbox
          options={typeOptions}
          value={draftType}
          onChange={setDraftType}
          placeholder="All types"
        />
      </FilterSheetField>

      <FilterSheetField label="Money flow">
        <Listbox
          options={directionOptions}
          value={draftDirection}
          onChange={setDraftDirection}
          placeholder="All flows"
        />
      </FilterSheetField>

      <FilterSheetField label="Employee">
        <Listbox
          searchable
          options={employeeOptions}
          value={draftEmployee}
          onChange={setDraftEmployee}
          placeholder="All employees"
        />
      </FilterSheetField>

      <FilterSheetField label="Reference">
        <Listbox
          searchable
          options={referenceOptions}
          value={draftReference}
          onChange={setDraftReference}
          placeholder="All references"
        />
      </FilterSheetField>

      <FilterSheetField label="Category">
        <Listbox
          options={categoryOptions}
          value={draftCategory}
          onChange={setDraftCategory}
          placeholder="All categories"
        />
      </FilterSheetField>

      <FilterSheetField label="Status">
        <Listbox
          options={statusOptions}
          value={draftStatus}
          onChange={setDraftStatus}
          placeholder="All statuses"
        />
      </FilterSheetField>
    </FilterSheet>
  );
};

export default TransactionsMobileFilters;
