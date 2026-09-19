import { Sun, Moon, Search } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { NotificationsPopover } from "../../ui/NotificationsPopover";

export function Topbar({ onOpenPalette }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform);

  return (
    <header className="mb-6 flex items-start justify-between gap-4 md:mb-8 md:gap-6">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(24px,6vw,30px)] font-semibold leading-tight text-[var(--ink)] md:text-[clamp(30px,3vw,38px)]">
          Hello, {firstName}.
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
          Here&apos;s what&apos;s happening with your billing today.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden lg:flex items-center gap-3 h-11 w-[360px] rounded-full bg-[var(--surface)] border border-[var(--border)] pl-5 pr-1.5 shadow-card transition-shadow hover:shadow-hover text-left"
        >
          <Search size={16} className="text-[var(--ink-muted)] shrink-0" />
          <span className="flex-1 text-sm text-[var(--ink-muted)] truncate">
            Search invoices, clients, or jump to a page...
          </span>
          <kbd className="inline-flex items-center gap-0.5 text-[10px] px-2 h-7 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border)] font-semibold">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>

        <IconButton
          onClick={onOpenPalette}
          title="Search"
          className="lg:hidden"
        >
          <Search size={16} />
        </IconButton>

        <IconButton onClick={toggle} title="Toggle theme">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <NotificationsPopover />
      </div>
    </header>
  );
}
