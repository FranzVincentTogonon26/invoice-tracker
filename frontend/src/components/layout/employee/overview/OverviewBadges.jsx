import { OVERVIEW_METHOD_TONES } from "@/constants";
import { cn, methodLabel } from "@/lib/utils";
import { Badge } from "../../../ui/Badge";

// Instant-scan method badge: tint per payment method so the type is readable
// without parsing text. Unknown methods fall back to neutral.
export function OverviewMethodBadge({ method, className }) {
  const tone = OVERVIEW_METHOD_TONES[method] ?? "neutral";
  return (
    <Badge
      tone={tone}
      className={cn("truncate shrink-0 px-2 py-1 text-[12px]", className)}
    >
      {methodLabel(method)}
    </Badge>
  );
}

// "This expense has a receipt attached" marker shared by the desktop table
// and the mobile cards. Size comes from the caller — table uses the default
// badge rhythm, cards pass the compact pill classes.
export function OverviewReceiptBadge({ className }) {
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
