import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Listbox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  renderTrigger,
  renderOption,
  buttonClassName,
  disabled = false,
  align = "start",
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      typeof option.label === "string"
        ? option.label.toLowerCase().includes(query)
        : true,
    );
  }, [options, search]);

  const commit = (option) => {
    setOpen(false);
    setActiveIndex(-1);
    onChange(option.value);
    buttonRef.current?.focus();
  };

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    buttonRef.current?.focus();
  }, []);

  // Clear the search whenever the dropdown closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Close on outside click while open
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) =>
          Math.min(i < 0 ? 0 : i + 1, filteredOptions.length - 1),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i < 0 ? 0 : i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(filteredOptions.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        {
          const activeOption = filteredOptions[activeIndex];
          if (activeOption) commit(activeOption);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  // Keyboard support while typing in the search box
  const handleSearchKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) =>
          Math.min(i < 0 ? 0 : i + 1, filteredOptions.length - 1),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i < 0 ? 0 : i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        {
          const activeOption = filteredOptions[activeIndex];
          if (activeOption) commit(activeOption);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          "group flex h-10 w-full items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)] outline-none transition-colors",
          "hover:border-[var(--accent)]/40 focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName,
        )}
      >
        {renderTrigger ? (
          renderTrigger(selectedOption)
        ) : (
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-[var(--ink-muted)]",
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--ink-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-40 mt-1.5 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {searchable && (
              <div className="border-b border-[var(--border)] px-3 pb-2 pt-1">
                <div className="relative flex items-center">
                  <Search
                    size={14}
                    aria-hidden
                    className="pointer-events-none absolute left-3 text-[var(--ink-muted)]"
                  />
                  <input
                    type="text"
                    value={search}
                    autoFocus
                    aria-label="Search options"
                    placeholder="Search..."
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] pl-8 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] transition-colors focus-visible:border-[var(--accent)]/50"
                  />
                </div>
              </div>
            )}

            <motion.ul
              id={listId}
              role="listbox"
              tabIndex={-1}
              className="max-h-60 overflow-y-auto"
            >
              {filteredOptions.map((option, index) => {
                const selected = option.value === value;
                const active = index === activeIndex;

                return (
                  <li
                    key={option.value ?? index}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={(e) => {
                      e.preventDefault();
                      commit(option);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm transition-colors",
                      selected
                        ? "text-[var(--accent-strong)] font-medium"
                        : "text-[var(--ink)]",
                      active && "bg-[var(--surface-2)]",
                    )}
                  >
                    {renderOption ? (
                      renderOption(option, { selected })
                    ) : (
                      <>
                        <span className="truncate flex-1">{option.label}</span>
                        {selected && (
                          <Check
                            size={14}
                            className="shrink-0 text-[var(--accent-strong)]"
                          />
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </motion.ul>

            {filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-sm text-[var(--ink-muted)]">
                No matches found
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
