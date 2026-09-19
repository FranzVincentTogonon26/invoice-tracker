import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 active:scale-[0.98]",
        accent:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] active:scale-[0.98]",
        outline:
          "bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
        ghost: "bg-transparent text-[var(--ink)] hover:bg-[var(--surface-2)]",
        soft: "bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]/80",
        danger:
          "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/85 active:scale-[0.98]",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-full sm:h-8",
        md: "h-11 px-4 text-sm rounded-full sm:h-10",
        lg: "h-12 px-6 text-sm rounded-full",
        icon: "h-11 w-11 rounded-full sm:h-10 sm:w-10",
        iconSm: "h-9 w-9 rounded-full sm:h-8 sm:w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export const Button = forwardRef(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
