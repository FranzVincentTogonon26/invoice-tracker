import { useMemo } from "react";
import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import Listbox from "./Listbox";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/constants";

/**
 * Icon shown next to each payment method in the trigger and dropdown rows.
 * `CreditCard` is the fallback for any custom/unknown method value.
 */
const METHOD_ICONS = {
  cash: Banknote,
  bank_transfer: Landmark,
  e_wallet: Wallet,
};

const MethodIcon = ({ method, className }) => {
  const Icon = METHOD_ICONS[method] ?? CreditCard;
  return (
    <Icon
      size={16}
      aria-hidden
      className={cn("shrink-0 text-[var(--ink-muted)]", className)}
    />
  );
};

/**
 * Payment-method dropdown built on the generic `Listbox`.
 * Defaults to `PAYMENT_METHODS`; pass `options` to override.
 * Each option shows an icon matching its method type.
 */
export const Select = ({ options, value, onChange, placeholder, disabled }) => {
  const methodOptions = useMemo(
    () => (Array.isArray(options) && options.length ? options : PAYMENT_METHODS),
    [options],
  );

  return (
    <Listbox
      options={methodOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Select payment method"}
      disabled={disabled}
      renderTrigger={(selectedOption) =>
        selectedOption ? (
          <span className="flex min-w-0 items-center gap-2">
            <MethodIcon method={selectedOption.value} />
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="truncate text-[var(--ink-muted)]">
            {placeholder || "Select payment method"}
          </span>
        )
      }
      renderOption={(option, { selected }) => (
        <>
          <MethodIcon
            method={option.value}
            className={cn(selected && "text-[var(--accent-strong)]")}
          />
          <span className="truncate flex-1">{option.label}</span>
          {selected && (
            <span className="shrink-0 text-[var(--accent-strong)]">✓</span>
          )}
        </>
      )}
    />
  );
};

Select.displayName = "Select";

export default Select;
