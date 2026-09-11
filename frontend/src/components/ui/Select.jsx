import { useMemo } from "react";
import Listbox from "./Listbox";
import { PAYMENT_METHODS } from "@/constants";

/**
 * Payment-method dropdown built on the generic `Listbox`.
 * Defaults to `PAYMENT_METHODS`; pass `options` to override.
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
    />
  );
};

Select.displayName = "Select";

export default Select;
