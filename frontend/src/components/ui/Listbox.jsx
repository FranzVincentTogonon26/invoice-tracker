import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function initialsOf(label) {
  return (
    String(label || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  );
}

// Employee avatar: real `<img>` when the option carries an `avatar` URL,
// initials fallback when the key exists but is empty. Options without an
// `avatar` key (e.g. "All employees", plain text filters) render nothing.
// "Boss" gets a temporary gray "B" avatar (same look as the ledger's
// Boss fallback block) until a real photo exists.
function OptionAvatar({ option, size = "sm" }) {
  if (!option) return null;
  const sizing = size === "sm" ? "h-7 w-7 text-[10px]" : "h-7 w-7 text-[11px]";
  if (
    String(option.label ?? "")
      .trim()
      .toLowerCase() === "boss"
  ) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-semibold text-[var(--ink-muted)]",
          sizing,
        )}
      >
        B
      </span>
    );
  }
  if (!("avatar" in option)) return null;
  if (option.avatar) {
    return (
      <img
        src={option.avatar}
        alt=""
        aria-hidden
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]",
          sizing,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]",
        sizing,
      )}
    >
      {initialsOf(option.label)}
    </span>
  );
}

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
  // Escape the trigger's clipping ancestors (a sliding filter track with
  // `overflow-hidden`, a scrollable modal body) by rendering the panel on
  // `document.body` at a fixed position measured from the trigger.
  portal = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
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

  // Fixed placement for the portaled panel: anchored to the trigger, kept
  // inside the viewport, and flipped above the trigger when the space below
  // runs out. Returns the previous object when nothing moved so the
  // every-render re-measure never loops.
  const place = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = rect.width;
    const left = align === "end" ? rect.right - width : rect.left;
    const height = panelRef.current?.offsetHeight ?? 0;

    let top = rect.bottom + 6;
    if (height > 0 && top + height > window.innerHeight - 8) {
      const above = rect.top - 6 - height;
      if (above >= 8) top = above;
    }

    setPos((prev) =>
      prev && prev.left === left && prev.top === top && prev.width === width
        ? prev
        : { left, top, width },
    );
  }, [align]);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPos(null);
      return undefined;
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, portal, place]);

  // Re-run after each render while open: the panel only exists from the
  // second pass on, and its height (search field, option count) is what the
  // flip above the trigger is measured against.
  useLayoutEffect(() => {
    if (open && portal && pos) place();
  });

  // Clear the search whenever the dropdown closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Close on outside click while open
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (
        !rootRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      )
        setOpen(false);
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

  const panel = (
    <>
      <AnimatePresence>
        {open && (!portal || pos) && (
          <motion.div
            key="listbox-panel"
            ref={panelRef}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              portal ? "fixed z-[90]" : "absolute z-40 mt-1.5 w-full",
              "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-hover",
              !portal && (align === "end" ? "right-0" : "left-0"),
            )}
            style={
              portal && pos
                ? { left: pos.left, top: pos.top, width: pos.width }
                : undefined
            }
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
                        <OptionAvatar option={option} />
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
    </>
  );

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
          "group flex  w-full items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 h-10  text-sm text-[var(--ink)] outline-none transition-colors",
          "hover:border-[var(--accent)]/40 focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName,
        )}
      >
        {renderTrigger ? (
          renderTrigger(selectedOption)
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <OptionAvatar option={selectedOption} size="sm" />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ink-muted)] transition-colors",
                !selectedOption && "text-[var(--ink-muted)]",
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
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

      {portal ? createPortal(panel, document.body) : panel}
    </div>
  );
}
