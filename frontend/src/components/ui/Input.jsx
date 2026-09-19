import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(
  ({ className, type = "text", Icon, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type={type}
        className={cn(
          "peer h-11 w-full appearance-none rounded-full border border-[var(--border)] bg-[var(--surface)] text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-colors focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-50 sm:h-10 sm:text-sm",
          "[appearance:textfield]",
          "[&::-webkit-inner-spin-button]:appearance-none",
          "[&::-webkit-outer-spin-button]:appearance-none",
          Icon ? "pl-11 pr-4" : "px-4",
          className,
        )}
        {...props}
      />
    );

    if (!Icon) return input;

    return (
      <div className="relative">
        {input}
        <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]  peer-[:not(:placeholder-shown)]:text-[var(--ink-muted)] transition-colors">
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
    );
  },
);
Input.displayName = "Input";

export const TextArea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    rows={3}
    ref={ref}
    className={cn(
      "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none resize-y focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15 sm:text-sm",
      className,
    )}
    {...props}
  />
));
TextArea.displayName = "TextArea";

export const SearchInput = forwardRef(
  ({ className, leftIcon, rightSlot, ...props }, ref) => (
    <div
      className={cn(
        "group flex items-center gap-3 h-11 rounded-full bg-[var(--surface)] border border-[var(--border)] pl-5 pr-1.5 shadow-card transition-shadow hover:shadow-hover focus-within:ring-2 focus-within:ring-[var(--accent)]/20 sm:h-10",
        className,
      )}
    >
      {leftIcon && (
        <span className="text-[var(--ink-muted)] shrink-0">{leftIcon}</span>
      )}
      <input
        ref={ref}
        type="text"
        className="flex-1 bg-transparent text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none sm:text-sm"
        {...props}
      />
      {rightSlot}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
