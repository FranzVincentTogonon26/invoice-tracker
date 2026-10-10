import { ArrowLeft } from "lucide-react";

export function BackButton({ onClick, label = "Back to employees" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
    >
      <ArrowLeft size={16} aria-hidden />
    </button>
  );
}

export function DetailsHeader({
  onBack,
  actions,
  description,
  backLabel,
}) {
  return (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} label={backLabel} />
      <div className="min-w-0 flex-1">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-sm"
        >
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Employees
          </button>
          <span
            aria-hidden
            className="shrink-0 text-[var(--ink-muted)] opacity-50"
          >
            /
          </span>
          <span className="truncate font-medium text-[var(--ink)]">
            Profile
          </span>
        </nav>
        {description && (
          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export default DetailsHeader;
