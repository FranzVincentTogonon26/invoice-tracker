import { Check } from "lucide-react";

// Avatar chip behind the employee dropdown — the same initials fallback the
// ledger's EmployeeCell uses, so a user without a stored avatar still reads
// as a person instead of an empty circle.
const EmployeeAvatar = ({ option }) => {
  const src = option?.avatar;
  const initials = String(option?.label ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold leading-none text-[var(--accent-strong)]"
    >
      {initials || "?"}
    </span>
  );
};

/**
 * Listbox props for the employee filter — spread into both the desktop inline
 * row and the mobile filter sheet so the two dropdowns search and render
 * identically: a search bar over the option labels plus a per-person avatar
 * in the trigger and in every option.
 */
export const employeeListboxProps = (placeholder = "All Employee") => ({
  searchable: true,
  renderTrigger: (option) =>
    option ? (
      <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <EmployeeAvatar option={option} />
        <span className="min-w-0 truncate text-xs font-semibold text-[var(--ink-muted)]">
          {option.label}
        </span>
      </span>
    ) : (
      <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-[var(--ink-muted)]">
        {placeholder}
      </span>
    ),
  renderOption: (option, { selected } = {}) => (
    <>
      {/* The leading "All Employee" sentinel is a filter, not a person —
          only real users get an avatar. */}
      {option?.value !== "all" && <EmployeeAvatar option={option} />}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {selected && (
        <Check size={14} className="shrink-0 text-[var(--accent-strong)]" />
      )}
    </>
  ),
});
