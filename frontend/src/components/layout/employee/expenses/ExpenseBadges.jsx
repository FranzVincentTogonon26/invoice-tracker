import {
  EXPENSES_DETAIL_METHOD_FALLBACK_ICON,
  EXPENSES_DETAIL_METHOD_ICONS,
  EXPENSES_METHOD_BADGE,
  EXPENSES_METHOD_FALLBACK,
} from "@/constants";
import { cn, methodLabel } from "@/lib/utils";
import { Badge } from "../../../ui/Badge";

export function ExpenseMethodBadge({ method, className }) {
  const config = EXPENSES_METHOD_BADGE[method] ?? EXPENSES_METHOD_FALLBACK;
  const BadgeIcon = config.Icon;
  return (
    <Badge
      tone={config.tone}
      className={cn("shrink-0 px-2 py-1 text-[12px]", className)}
    >
      <BadgeIcon size={16} aria-hidden />
      {methodLabel(method)}
    </Badge>
  );
}

// "This expense has a receipt attached" marker shared by the desktop table
// and the mobile cards. Size comes from the caller — the table uses the
// default badge rhythm, cards pass the compact pill classes.
export function ExpenseReceiptBadge({ className }) {
  return (
    <Badge
      tone="accent"
      title="This expense has a receipt attached"
      className={className}
    >
      <span role="img" aria-label="Receipt attached" className="truncate">
        Receipt
      </span>
    </Badge>
  );
}

// Small inline glyph for the payment method in the details modal.
export function ExpenseMethodIcon({ method }) {
  const Icon =
    EXPENSES_DETAIL_METHOD_ICONS[method] ?? EXPENSES_DETAIL_METHOD_FALLBACK_ICON;
  return <Icon size={13} aria-hidden />;
}
