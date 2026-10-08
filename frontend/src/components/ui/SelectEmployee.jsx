import { useState } from "react";
import Listbox from "./Listbox";
import { cn } from "@/lib/utils";

/**
 * Employee avatar: real `<img>` when `avatar_url` exists (falls back to the
 * initials circle on load error), otherwise the initials circle.
 * Empty / whitespace URLs never render an <img> so no broken-image icon appears.
 */
export function EmployeeAvatar({ name, avatarUrl, className }) {
  // Tracks WHICH url failed (not just a boolean) so a new avatarUrl
  // automatically retries without needing a useEffect reset.
  const [failedUrl, setFailedUrl] = useState(null);
  const cleanUrl =
    typeof avatarUrl === "string" ? avatarUrl.trim() : avatarUrl;
  const showImage = !!cleanUrl && failedUrl !== cleanUrl;
  const initials =
    String(name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?";

  if (!showImage) {
    return (
      <span
        className={cn(
          "h-8 w-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-medium flex items-center justify-center text-sm ring-1 ring-[var(--surface)] shrink-0",
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={cleanUrl}
      alt=""
      aria-hidden
      onError={() => setFailedUrl(cleanUrl)}
      className={cn(
        "h-8 w-8 rounded-full object-cover ring-2 ring-[var(--surface)] shrink-0",
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
  searchable = true,
  // Optional overrides so a caller can restyle the trigger (e.g. match an
  // owner/recipient card) without changing this default dropdown look.
  buttonClassName,
  renderTrigger,
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

  const defaultRenderTrigger = (selectedOption) =>
    selectedOption ? (
      <span className="flex items-center gap-2 min-w-0 -ml-1.5">
        {renderAvatar(selectedOption.label, selected?.avatar_url)}
        <span className="truncate">{selectedOption.label}</span>
      </span>
    ) : (
      <span className="truncate text-[var(--ink-muted)]">
        {placeholder || "Select employee"}
      </span>
    );

  return (
    <Listbox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select employee"}
      disabled={disabled}
      searchable={searchable}
      buttonClassName={buttonClassName}
      renderTrigger={renderTrigger ?? defaultRenderTrigger}
      renderOption={(option, { selected: isSelected }) => (
        <>
          {renderAvatar(option.label, option.employee?.avatar_url)}
          <span className="truncate flex-1">{option.label}</span>
          {isSelected && (
            <span className="shrink-0 text-[var(--accent-strong)]">✓</span>
          )}
        </>
      )}
    />
  );
};

SelectEmployee.displayName = "SelectEmployee";

export default SelectEmployee;
