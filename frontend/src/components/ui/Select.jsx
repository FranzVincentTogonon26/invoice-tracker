import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Check,
  ChevronDown,
  Landmark,
  MoreHorizontal,
  Wallet,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = forwardRef(
  (
    {
      className,
      options = [],
      value,
      defaultValue,
      onChange,
      placeholder = "Select an option",
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const [internalValue, setInternalValue] = useState(defaultValue);
    const rootRef = useRef(null);

    const currentValue = value !== undefined ? value : internalValue;
    const selectedIndex = options.findIndex((o) => o.value === currentValue);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

    // close when clicking outside
    useEffect(() => {
      if (!open) return;
      const onPointerDown = (e) => {
        if (rootRef.current && !rootRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", onPointerDown);
      return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const openMenu = () => {
      setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
    };

    const commit = (index) => {
      const opt = options[index];
      if (!opt) return;
      if (value === undefined) setInternalValue(opt.value);
      onChange?.(opt.value, opt);
      setOpen(false);
    };

    const onKeyDown = (e) => {
      if (disabled) return;
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (open) commit(highlighted);
          else openMenu();
          break;
        case "Escape":
          setOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!open) {
            openMenu();
            break;
          }
          setHighlighted((h) => Math.min(h + 1, options.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!open) {
            openMenu();
            break;
          }
          setHighlighted((h) => Math.max(h - 1, 0));
          break;
        default:
          break;
      }
    };

    return (
      <div
        ref={rootRef}
        className={cn("relative w-full", className)}
        {...props}
      >
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none transition-colors",
            "focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-[var(--accent)]/50 ring-2 ring-[var(--accent)]/15",
          )}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2.5 truncate",
              selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
            )}
          >
            {selected?.icon && (
              <span className="shrink-0 text-[var(--ink-muted)]">
                {selected.icon}
              </span>
            )}
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-[var(--ink-muted)] transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-hover"
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === currentValue;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => commit(i)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-sm transition-colors",
                        isSelected
                          ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]"
                          : "text-[var(--ink)]",
                        !isSelected &&
                          i === highlighted &&
                          "bg-[var(--surface-2)]",
                      )}
                    >
                      {opt.icon && (
                        <span
                          className={cn(
                            "shrink-0",
                            isSelected
                              ? "text-[var(--accent-strong)]"
                              : "text-[var(--ink-muted)]",
                          )}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate text-left">
                        {opt.label}
                      </span>
                      {isSelected && <Check size={14} className="shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
Select.displayName = "Select";

// ready-made option list for payment methods
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: <Banknote size={16} /> },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
    icon: <Landmark size={16} />,
  },
  {
    value: "e_wallet",
    label: "E-Wallet (GCash / Maya)",
    icon: <Wallet size={16} />,
  },
];
