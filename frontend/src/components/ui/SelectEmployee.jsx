import { useState } from "react";
import Listbox from "./Listbox";
import { cn } from "@/lib/utils";

/**
 * Employee avatar: real `<img>` when `avatar_url` exists (falls back to the
 * initial-letter circle on load error), otherwise the initial-letter circle.
 */
export function EmployeeAvatar({ name, avatarUrl, className }) {
  const [failed, setFailed] = useState(false);
  const initial = name?.[0]?.toUpperCase() || "?";

  const fallback = (
    <span
      className={cn(
        "h-7.5 w-7.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold flex items-center justify-center text-sm ring-2 ring-[var(--surface)] shrink-0",
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );

  if (!avatarUrl || failed) return fallback;

  return (
    <img
      src={avatarUrl}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className={cn(
        "h-7.5 w-7.5 rounded-full object-cover ring-2 ring-[var(--surface)] shrink-0",
        className,
      )}
    />
  );
}

/**
 * Employee dropdown built on the generic `Listbox`.
 *
 * `employees` are the admin's budget rows (`GET /budgets`): items with
 * `user_id` and `name` (optional `avatar_url`). The selected `value` is a
 * `user_id` — keys/selection must never use `employee.name`.
 */
export const SelectEmployee = ({
  employees = [],
  value,
  onChange,
  placeholder,
  disabled,
}) => {
  const options = employees.map((employee) => ({
    value: employee.user_id,
    label: employee.name || "Unnamed employee",
    employee,
  }));

  const selected = employees.find((employee) => employee.user_id === value);

  const renderAvatar = (name, avatarUrl) => (
    <EmployeeAvatar name={name} avatarUrl={avatarUrl} />
  );

  return (
    <Listbox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select employee"}
      disabled={disabled}
      renderTrigger={(selectedOption) =>
        selectedOption ? (
          <span className="flex items-center gap-2 min-w-0">
            {renderAvatar(selectedOption.label, selected?.avatar_url)}
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="truncate text-[var(--ink-muted)]">
            {placeholder || "Select employee"}
          </span>
        )
      }
      renderOption={(option, { selected: isSelected }) => (
        <>
          {renderAvatar(option.label, option.employee?.avatar_url)}
          <span className="truncate flex-1">{option.label}</span>
          {isSelected && <span className="shrink-0 text-[var(--accent-strong)]">✓</span>}
        </>
      )}
    />
  );
};

SelectEmployee.displayName = "SelectEmployee";

export default SelectEmployee;
