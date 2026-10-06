import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutGrid,
  FileText,
  Users,
  Receipt,
  ArrowLeftRight,
  Logs,
  UserRound,
  Plus,
  HandCoins,
  Wallet,
  House,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { USER_ROLES } from "@/constants";
import { useEmployees } from "@/hooks/useEmployees";
import { EmployeeAvatar } from "@/components/ui/SelectEmployee";

// Navigation targets must mirror routes.jsx exactly — every `to` below is a
// real route, so palette jumps never land on the "*" fallthrough.
const ADMIN_NAV = [
  {
    id: "nav:dashboard",
    kind: "nav",
    label: "Dashboard",
    hint: "Overview",
    to: "/admin/dashboard",
    icon: LayoutGrid,
  },
  {
    id: "nav:budget",
    kind: "nav",
    label: "Budget",
    hint: "Allocate & issue",
    to: "/admin/budget",
    icon: FileText,
  },
  {
    id: "nav:transactions",
    kind: "nav",
    label: "Transactions",
    hint: "Unified ledger",
    to: "/admin/transaction",
    icon: ArrowLeftRight,
  },
  {
    id: "nav:employees",
    kind: "nav",
    label: "Employees",
    hint: "Roster & balances",
    to: "/admin/employees",
    icon: Users,
  },
  {
    id: "nav:expenses",
    kind: "nav",
    label: "Expenses",
    hint: "Ledger",
    to: "/admin/expenses",
    icon: Receipt,
  },
  {
    id: "nav:audit",
    kind: "nav",
    label: "Audit Logs",
    hint: "Activity trail",
    to: "/admin/audit-logs",
    icon: Logs,
  },
];

const ADMIN_ACTIONS = [
  {
    id: "action:add-expense",
    kind: "action",
    label: "Add Expense",
    hint: "New expense lines",
    to: "/admin/expenses/add",
    icon: Plus,
  },
];

const EMPLOYEE_NAV = [
  {
    id: "nav:overview",
    kind: "nav",
    label: "Overview",
    hint: "My summary",
    to: "/employee/overview",
    icon: House,
  },
  {
    id: "nav:budget",
    kind: "nav",
    label: "My Budget",
    hint: "Issued & transfers",
    to: "/employee/budget",
    icon: Wallet,
  },
  {
    id: "nav:expenses",
    kind: "nav",
    label: "Expenses",
    hint: "My ledger",
    to: "/employee/expenses",
    icon: FileText,
  },
  {
    id: "nav:abono",
    kind: "nav",
    label: "Abono",
    hint: "Top-ups",
    to: "/employee/abono",
    icon: HandCoins,
  },
];

const EMPLOYEE_ACTIONS = [
  {
    id: "action:add-expense",
    kind: "action",
    label: "Add Expense",
    hint: "New expense lines",
    to: "/employee/expenses/add",
    icon: Plus,
  },
  {
    id: "action:transfer",
    kind: "action",
    label: "Transfer Budget",
    hint: "Move funds",
    to: "/employee/budget-transfer",
    icon: ArrowLeftRight,
  },
];

function scoreMatch(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = (text || "").toLowerCase();
  if (!t) return 0;
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

export function CommandPalette({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && <PaletteBody onClose={onClose} />}
    </AnimatePresence>
  );
}

function PaletteBody({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Admin-only directory search — employees never see the roster, so the
  // request fires for admins only (the endpoint itself is admin-guarded).
  const { data: employees } = useEmployees(undefined, {
    enabled: Boolean(isAdmin),
  });

  // Fresh mount on every open, so query/activeIdx start clean.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo(() => {
    const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
    const actions = isAdmin ? ADMIN_ACTIONS : EMPLOYEE_ACTIONS;

    const employeeItems = (isAdmin ? employees || [] : []).map((e) => ({
      id: `employee:${e.user_id}`,
      kind: "employee",
      label: e.name || "Unnamed employee",
      hint: e.email || e.status || "Employee",
      to: `/admin/employees/${e.user_id}`,
      icon: UserRound,
      avatarUrl: e.avatar_url || "",
    }));

    const pool = [...nav, ...actions, ...employeeItems];
    if (!query.trim()) return pool;

    return pool
      .map((it) => ({
        it,
        score: scoreMatch(query.trim(), `${it.label} ${it.hint || ""}`),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  }, [employees, isAdmin, query]);

  // The pool shrinks as data loads / the query changes — clamp the cursor so
  // Enter can never fire on a stale out-of-range index.
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) {
        navigate(it.to);
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const groups = [
    {
      key: "nav",
      title: "Navigate",
      items: items.filter((i) => i.kind === "nav"),
    },
    {
      key: "action",
      title: "Quick actions",
      items: items.filter((i) => i.kind === "action"),
    },
    ...(isAdmin
      ? [
          {
            key: "employee",
            title: "Employees",
            items: items.filter((i) => i.kind === "employee"),
          },
        ]
      : []),
  ];

  let renderIdx = -1;
  function renderItem(it) {
    renderIdx += 1;
    const idx = renderIdx;
    const Icon = it.icon;
    const isActive = idx === activeIdx;
    return (
      <button
        key={it.id}
        data-idx={idx}
        onMouseEnter={() => setActiveIdx(idx)}
        onClick={() => {
          navigate(it.to);
          onClose();
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
          isActive
            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
            : "hover:bg-[var(--surface-2)] text-[var(--ink)]",
        )}
      >
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
            isActive
              ? "bg-[var(--surface)] text-[var(--accent-strong)]"
              : "bg-[var(--surface-2)] text-[var(--ink-muted)]",
          )}
        >
          {it.kind === "employee" ? (
            <EmployeeAvatar
              name={it.label}
              avatarUrl={it.avatarUrl}
              className="h-9 w-9 rounded-xl text-sm"
            />
          ) : (
            <Icon size={16} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{it.label}</div>
          {it.hint && (
            <div className="text-xs text-[var(--ink-muted)] truncate capitalize">
              {it.hint}
            </div>
          )}
        </div>
        {isActive && (
          <span className="text-xs text-[var(--ink-muted)] flex items-center gap-1 shrink-0">
            <CornerDownLeft size={12} /> Enter
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[640px] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--ink-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isAdmin
                ? "Search employees or jump to a page..."
                : "Jump to a page..."
            }
            className="flex-1 bg-transparent outline-none text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-xs px-2 h-6 rounded-md bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border)] font-medium">
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[52vh] overflow-y-auto overscroll-contain p-2"
        >
          {items.length === 0 && (
            <div className="text-center text-sm text-[var(--ink-muted)] py-10">
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}

          {groups.map((g) =>
            g.items.length ? (
              <div key={g.key} className="mb-1">
                <div className="px-3 pt-2 pb-1 type-eyebrow text-[var(--ink-muted)]">
                  {g.title}
                </div>
                <div className="flex flex-col gap-0.5">
                  {g.items.map(renderItem)}
                </div>
              </div>
            ) : null,
          )}
        </div>

        <div className="flex items-center justify-between px-5 h-10 border-t border-[var(--border)] bg-[var(--surface-2)]/60 text-xs text-[var(--ink-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 h-5 rounded bg-[var(--surface)] border border-[var(--border)] inline-flex items-center">
                ↑
              </kbd>
              <kbd className="px-1.5 h-5 rounded bg-[var(--surface)] border border-[var(--border)] inline-flex items-center">
                ↓
              </kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 h-5 rounded bg-[var(--surface)] border border-[var(--border)] inline-flex items-center">
                ↵
              </kbd>
              to select
            </span>
          </div>
          <span>
            {items.length} result{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
