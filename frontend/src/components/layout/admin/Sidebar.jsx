import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  FileText,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import AILogo from "../../ui/AILogo";

const NAV = [
  { to: "/dashboard", icon: LayoutGrid, label: "Dashboard", primary: true },
  { to: "/admin/budget", icon: FileText, label: "Budget", primary: true },
  { to: "/admin/employees", icon: Users, label: "Employee", primary: true },
  { to: "/expenses", icon: Receipt, label: "Expenses", primary: true },
  { to: "/payments", icon: Wallet, label: "Payments" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

// `md` is the hand-off point: from here up the hover-expanding rail is used,
// below it every mobile surface takes over. Kept in sync with the `md:`
// classes below (Tailwind's default `md` breakpoint = 768px).
const DESKTOP_QUERY = "(min-width: 768px)";

// Entrance/exit curve shared with the rest of the app's overlays.
const SHEET_EASE = [0.16, 1, 0.3, 1];

// Primary destinations are pinned to the mobile dock; every entry is listed
// in the mobile menu sheet.
const DOCK_ITEMS = NAV.filter((item) => item.primary);

const ROW_BASE =
  "relative flex items-center h-11 w-11 rounded-2xl overflow-hidden " +
  "group-hover/sidebar:w-[200px] " +
  "transition-[width,background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

const LABEL_BASE =
  "text-sm font-medium whitespace-nowrap pr-4 " +
  "opacity-0 -translate-x-1 " +
  "transition-[opacity,transform] duration-200 ease-out " +
  "group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:delay-100";

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} className="block">
      {({ isActive }) => (
        <div
          className={cn(
            ROW_BASE,
            isActive
              ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-card"
              : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
          )}
        >
          <span className="h-11 w-11 flex items-center justify-center shrink-0">
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className={LABEL_BASE}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function ActionRow({ icon: Icon, label, onClick, to }) {
  const inner = (isActive) => (
    <div
      className={cn(
        ROW_BASE,
        isActive
          ? "bg-[var(--ink)] text-[var(--bg)] shadow-card"
          : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
      )}
    >
      <span className="h-11 w-11 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </span>
      <span className={LABEL_BASE}>{label}</span>
    </div>
  );

  if (to) {
    return (
      <NavLink to={to} title={label} className="block">
        {({ isActive }) => inner(isActive)}
      </NavLink>
    );
  }

  return (
    <button onClick={onClick} title={label} className="block">
      {inner(false)}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Mobile (below `md`)
 *
 * The rail is replaced by two surfaces that re-use the same tokens and motion:
 *   1. <MobileDock>      — a floating, thumb-reachable pill pinned to the
 *                          bottom edge holding the primary destinations.
 *   2. <MobileMenuSheet> — a bottom sheet with the full nav grid, the account
 *                          card, and the Settings / Log out rows.
 * Both are `md:hidden`, so the desktop layout is untouched.
 * ------------------------------------------------------------------------- */

const DOCK_CELL =
  "flex-1 min-w-0 rounded-full focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30";

const DOCK_INNER =
  "relative flex h-12 w-full flex-col items-center justify-center gap-0.5 " +
  "rounded-full transition-colors duration-200";

const SHEET_TILE =
  "flex items-center gap-2.5 rounded-2xl border px-3 py-3 transition-colors";

const ACCOUNT_ROW =
  "flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium " +
  "transition-colors focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30";

const ACCOUNT_ICON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
  "bg-[var(--surface-2)] text-[var(--ink-muted)]";

const SHEET_LABEL =
  "mt-5 px-1 text-[10px] font-semibold uppercase tracking-wider " +
  "text-[var(--ink-muted)]";

/**
 * Floating bottom dock for small screens — the four primary destinations plus
 * a "Menu" trigger that opens the full <MobileMenuSheet>. The active item is
 * marked by a sliding accent pill (`layoutId`, same technique as `Tabs`).
 */
function MobileDock({ onOpenMenu }) {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="pointer-events-auto flex w-full max-w-[420px] items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/85 p-1.5 shadow-hover backdrop-blur-xl">
        {DOCK_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} title={label} className={DOCK_CELL}>
            {({ isActive }) => (
              <span
                className={cn(
                  DOCK_INNER,
                  isActive
                    ? "text-[var(--accent-strong)]"
                    : "text-[var(--ink-muted)]",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-dock-active"
                    className="absolute inset-0 rounded-full bg-[var(--accent-soft)]"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.18 }}
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.4 : 2}
                  className="relative z-10"
                />
                <span className="relative z-10 max-w-full truncate text-[10px] font-medium leading-none">
                  {label}
                </span>
              </span>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={onOpenMenu}
          title="More"
          aria-label="More navigation"
          className={cn(DOCK_CELL, "text-[var(--ink-muted)]")}
        >
          <span className={cn(DOCK_INNER, "hover:bg-[var(--surface-2)]")}>
            <MenuIcon size={18} />
            <span className="max-w-full truncate text-[10px] font-medium leading-none">Menu</span>
          </span>
        </button>
      </div>
    </nav>
  );
}

/**
 * Bottom-sheet navigation for small screens — the mobile counterpart of the
 * rail: brand + signed-in account, the full nav grid, then Settings and
 * Log out. Locks page scroll behind it and dismisses on Escape, backdrop tap,
 * row tap, or navigation.
 */
function MobileMenuSheet({ open, onClose, onLogout, user }) {
  const panelRef = useRef(null);
  const displayName = user?.name || "Account";
  const displayEmail = user?.email || "";
  const initial = user?.name?.[0]?.toUpperCase() || "R";

  // Lock page scroll behind the sheet (same contract as the row dialogs).
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape dismisses it. Capture phase + stopPropagation keeps page-level
  // Escape handlers from also firing (matches the dialog pattern).
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  // Move focus into the sheet so Tab walks its rows instead of continuing
  // somewhere behind the backdrop.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.34, ease: SHEET_EASE }}
            className={cn(
              "relative w-full max-h-[88dvh] overflow-y-auto scrollbar-slim outline-none",
              "rounded-t-[28px] border border-b-0 border-[var(--border)]",
              "bg-[var(--surface)] shadow-hover",
              "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
            )}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--ink-muted)]/25" />

            <div className="flex items-center gap-3 pt-4">
              <AILogo />
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-semibold text-[var(--ink)]">
                  Budget Tracker
                </div>
                <div className="text-[11px] text-[var(--ink-muted)]">
                  Jump to any part of your workspace
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <X size={16} />
              </button>
            </div>

            {/* Signed-in account */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)] ring-2 ring-[var(--surface)]">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--ink)]">
                  {displayName}
                </div>
                {displayEmail && (
                  <div className="truncate text-[11px] text-[var(--ink-muted)]">
                    {displayEmail}
                  </div>
                )}
              </div>
            </div>

            <div className={SHEET_LABEL}>Menu</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {NAV.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className="block min-w-0 focus-visible:outline-none"
                >
                  {({ isActive }) => (
                    <span
                      className={cn(
                        SHEET_TILE,
                        isActive
                          ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-card"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          isActive
                            ? "bg-[var(--surface)] text-[var(--accent-strong)]"
                            : "bg-[var(--surface-2)]",
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className={SHEET_LABEL}>Account</div>
            <div className="mt-2 flex flex-col gap-1">
              <NavLink
                to="/settings"
                onClick={onClose}
                className="block focus-visible:outline-none"
              >
                {({ isActive }) => (
                  <span
                    className={cn(
                      ACCOUNT_ROW,
                      "hover:bg-[var(--surface-2)]",
                      isActive
                        ? "text-[var(--accent-strong)]"
                        : "text-[var(--ink)]",
                    )}
                  >
                    <span className={ACCOUNT_ICON}>
                      <Settings size={16} />
                    </span>
                    Settings
                  </span>
                )}
              </NavLink>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className={cn(
                  ACCOUNT_ROW,
                  "text-[var(--danger)] hover:bg-[var(--danger)]/10",
                )}
              >
                <span
                  className={cn(
                    ACCOUNT_ICON,
                    "bg-[var(--danger)]/10 text-[var(--danger)]",
                  )}
                >
                  <LogOut size={16} />
                </span>
                Log out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const displayName = user?.name || "Account";
  const displayEmail = user?.email || "";

  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile sheet on navigation (adjust state during render — the
  // documented alternative to a setState-in-effect, matching the shells).
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The hover rail takes over at `md`. If the viewport grows while the sheet
  // is open, dismiss it so a mobile-only overlay (and its scroll lock) can
  // never linger behind the desktop layout.
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return undefined;
    const onChange = (event) => {
      if (event.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <aside
        className={cn(
          "group/sidebar hidden md:flex shrink-0 h-[calc(100vh-32px)] sticky top-4 ml-4",
          "flex-col items-center justify-between py-5 rounded-3xl",
          "bg-[var(--surface)] border border-[var(--border)] shadow-card overflow-hidden",
          "w-[88px] hover:w-[248px]",
          "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <div className="flex flex-col items-center gap-6 w-full">
          <div
            className={cn(
              "flex items-center h-14 w-14 group-hover/sidebar:w-[200px]",
              "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <div className="h-12 w-12 flex items-center justify-center shrink-0">
              <AILogo />
            </div>
            <span
              className={cn(
                "ml-0 font-display text-base font-semibold text-[var(--ink)] whitespace-nowrap",
                "opacity-0 -translate-x-1",
                "transition-[opacity,transform] duration-200 ease-out",
                "group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:delay-100",
              )}
            >
              Budget Tracker
            </span>
          </div>

          <nav className="flex flex-col items-center gap-1.5">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2 w-full">
          <ActionRow icon={Settings} label="Settings" to="/settings" />
          <ActionRow icon={LogOut} label="Log out" onClick={logout} />

          <div
            className={cn(
              "flex items-center h-12 mt-1 w-10 group-hover/sidebar:w-[200px] overflow-hidden",
              "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <div className="h-10 w-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold flex items-center justify-center text-sm ring-2 ring-[var(--surface)] shrink-0">
              {user?.name?.[0]?.toUpperCase() || "R"}
            </div>
            <div
              className={cn(
                "ml-3 min-w-0 flex-1",
                "opacity-0 -translate-x-1",
                "transition-[opacity,transform] duration-200 ease-out",
                "group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:delay-100",
              )}
            >
              <div className="text-sm font-semibold text-[var(--ink)] truncate">
                {displayName}
              </div>
              {displayEmail && (
                <div className="text-[11px] text-[var(--ink-muted)] truncate">
                  {displayEmail}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile — thumb-reachable dock + full menu sheet (md:hidden) */}
      <MobileDock onOpenMenu={openMenu} />
      <MobileMenuSheet
        open={menuOpen}
        onClose={closeMenu}
        onLogout={logout}
        user={user}
      />
    </>
  );
}
