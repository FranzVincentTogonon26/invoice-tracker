import { MethodIcon } from "../../../ui/Select";
import { cn, methodLabel } from "../../../../lib/utils";


/**
 * Payment-method cell: small circular icon chip on a soft accent background
 * followed by the method label (see design spec — "Method" column).
 */
export function PaymentMethod({ method, className }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--ink-muted)]">
        <MethodIcon method={method} className="text-[var(--ink-muted)]" />
      </span>
      <span className="truncate text-xs transition-colors text-[var(--ink-muted)]">
        {methodLabel(method)}
      </span>
    </div>
  );
}
