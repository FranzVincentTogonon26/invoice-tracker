import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RotateCcw,
  Search,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { SearchInput } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { cn, formatDate, formatMoney, formatTime } from "../../../../lib/utils";
import { useBudgetIssuedTransaction } from "../../../../hooks/useBudget";
import { PAYMENT_METHODS, STATUS } from "../../../../constants";
import { MethodIcon } from "../../../ui/Select";
import { PaymentMethod, methodLabel } from "./PaymentMethod";

// Column proportions from the design spec. The percentages sum to exactly
// 100% so `table-fixed` never overflows the scroll container. Amount gets
// the extra 2% because right-aligned money values need the room.
const COLUMN_WIDTHS = ["13%", "12%", "5%", "8%", "7%", "12%", "7%", "4%", "5%"];

const HEADERS = [
  { label: "Employee" },
  { label: "Description" },
  { label: "Source of Funds" },
  { label: "Amount", align: "right" },
  { label: "Payment" },
  { label: "Notes" },
  { label: "Date Issued" },
  { label: "Status", align: "center" },
  { label: "Actions", srOnly: true },
];

// Client-side page size — the API returns the full filtered list.
const PAGE_SIZE = 100;

// Compact page-number window for the pager ("1 … 4 5 6 … 12") — same pattern
// as BudgetTransaction so both budget tables paginate identically.
const pageItems = (count, current) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const items = [0];
  if (current > 2) items.push("…");
  for (
    let i = Math.max(1, current - 1);
    i <= Math.min(count - 2, current + 1);
    i++
  ) {
    items.push(i);
  }
  if (current < count - 3) items.push("…");
  items.push(count - 1);
  return items;
};

/* ── Cell building blocks ────────────────────────────────────────────────── */

// Avatar with an initials fallback (users.avatar_url is usually NULL).
function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function EmployeeCell({ name, role, avatarUrl }) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-strong)]"
        >
          {initialsOf(name) || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-[var(--ink)]">
          {name || "Unknown"}
        </p>
        <p className="mt-0.5 truncate text-xs capitalize text-[var(--ink-muted)]">
          {role || "—"}
        </p>
      </div>
    </div>
  );
}

function NotesCell({ notes }) {
  if (!notes) return <span className="text-xs text-[var(--ink-muted)]">—</span>;
  return (
    <p
      title={notes}
      className="line-clamp-2 whitespace-normal break-words text-xs leading-relaxed text-[var(--ink-muted)]"
    >
      {notes}
    </p>
  );
}

function DateIssuedCell({ date }) {
  return (
    <>
      <p className="text-xs leading-none tabular-nums text-[var(--ink)]">
        {formatDate(date)}
      </p>
      <p className="mt-1 text-[10px] leading-none tabular-nums text-[var(--ink-muted)]">
        {formatTime(date)}
      </p>
    </>
  );
}

function SourceOfFundsCell({ label }) {
  if (!label) return <span className="text-xs text-[var(--ink-muted)]">—</span>;
  return (
    <div className="text-xs">
      {/* `block` + `truncate` so long labels ellipsize inside the fixed column */}
      <span className="block truncate">{label}</span>
    </div>
  );
}

/* ── Row + card ──────────────────────────────────────────────────────────── */

/**
 * Desktop table row. `<td>` cells follow the fixed column proportions set in
 * `COLUMN_WIDTHS` — Employee · Description · Notes · Amount (right) ·
 * Payment Method · Source of Funds · Date Issued · Status (center).
 */
export function BudgetIssuedRow({ transaction: t }) {
  return (
    <tr className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/60">
      <td className="px-4 py-3 pl-5 align-middle">
        <EmployeeCell
          name={t.employee}
          role={t.employee_role}
          avatarUrl={t.avatar_url}
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="text-xs leading-snug text-[var(--ink)]">
          {t.description}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        <SourceOfFundsCell label={t.source_of_funds} />
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge tone="neutral" className="max-w-full">
          <PaymentMethod method={t.method} />
        </Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        <NotesCell notes={t.notes} />
      </td>
      <td className="px-4 py-3 align-middle">
        <DateIssuedCell date={t.date_issued} />
      </td>
      <td className="px-4 py-3 text-center align-middle">
        <StatusBadge status={t.status} />
      </td>
      <td className="px-4 py-3 pr-5 align-middle">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/30",
            "text-[var(--ink-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]",
          )}
        >
          <Ban size={13} strokeWidth={2.5} aria-hidden />
          Cancel
        </button>
      </td>
    </tr>
  );
}

/**
 * Mobile transaction card — every column's information stays accessible in a
 * compact stacked layout (employees often use the app from their phones).
 */
export function BudgetIssuedCard({ transaction: t }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card transition-shadow hover:shadow-hover">
      <div className="flex items-center justify-between gap-3">
        <EmployeeCell
          name={t.employee}
          role={t.employee_role}
          avatarUrl={t.avatar_url}
        />
        <StatusBadge status={t.status} />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-[var(--ink)]">
            {t.description}
          </p>
          {t.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-muted)]">
              {t.notes}
            </p>
          )}
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums text-[var(--ink)]">
          {formatMoney(t.amount)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-muted)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <MethodIcon method={t.method} />
          <span className="truncate">{methodLabel(t.method)}</span>
        </span>
        {t.source_of_funds && (
          <span className="min-w-0 truncate capitalize">
            {t.source_of_funds}
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">
          {formatDate(t.date_issued)} · {formatTime(t.date_issued)}
        </span>
      </div>
    </div>
  );
}

const TableSkeleton = () => (
  <div className="divide-y divide-[var(--border)]" aria-hidden>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-5">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-2.5 w-1/4 animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div className="hidden h-4 w-20 animate-pulse rounded bg-[var(--border)] sm:block" />
        <div className="hidden h-6 w-16 animate-pulse rounded-full bg-[var(--border)] md:block" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ refetch }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--danger)]/12 text-[var(--danger)]">
      <RotateCcw size={20} />
    </div>
    <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
      Couldn&apos;t load issued transactions
    </p>
    <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
      Something went wrong while fetching budget issuances.
    </p>
    <button
      type="button"
      onClick={() => refetch()}
      className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
    >
      <RotateCcw size={12} />
      Try again
    </button>
  </div>
);

const EmptyState = ({ hasActiveFilters, clearFilters }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
      <Inbox size={20} />
    </div>
    <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
      {hasActiveFilters
        ? "No issued transactions match your search"
        : "No issued budget transactions yet"}
    </p>
    {hasActiveFilters ? (
      <button
        type="button"
        onClick={clearFilters}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]"
      >
        <RotateCcw size={12} />
        Clear search
      </button>
    ) : (
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--ink-muted)]">
        Budgets issued to employees will appear here.
      </p>
    )}
  </div>
);

const PagerButton = ({
  label,
  children,
  active = false,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    aria-label={label}
    aria-current={active ? "page" : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors",
      active
        ? "border-transparent bg-[var(--accent-strong)] text-white"
        : "border-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
      disabled && "pointer-events-none opacity-40",
    )}
  >
    {children}
  </button>
);

/**
 * Budget Issued Transactions — every budget handed out to an employee.
 * Desktop: semantic `<table>` with a soft mint header, generous row padding
 * and horizontal scrolling when space is tight (keyboard/touch reachable).
 * Mobile: stacked transaction cards so nothing becomes unreadable.
 */
const BudgetIssuedTransaction = () => {
  const [search, setSearch] = useState("");
  // Debounced copy of `search` so we don't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Dropdown filters — "all" shows every row until a specific value is picked.
  const [employee, setEmployee] = useState("all");
  const [method, setMethod] = useState("all");
  const [fund, setFund] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateSearch = (value) => {
    setSearch(value);
    setPage(0);
  };

  // Dropdown filter setters — every filter change also snaps back to page 0.
  const updateEmployee = (value) => {
    setEmployee(value);
    setPage(0);
  };
  const updateMethod = (value) => {
    setMethod(value);
    setPage(0);
  };
  const updateFund = (value) => {
    setFund(value);
    setPage(0);
  };
  const updateStatus = (value) => {
    setStatus(value);
    setPage(0);
  };

  const { data, isLoading, error, refetch } = useBudgetIssuedTransaction({
    search: debouncedSearch.trim() || undefined,
  });

  // The hook already resolves `data` to an array.
  const rows = useMemo(() => data ?? [], [data]);

  // ── Dropdown options (derived client-side from the loaded rows) ─────────

  const employeeOptions = useMemo(() => {
    const names = [];
    for (const r of rows) {
      if (r.employee && !names.includes(r.employee)) names.push(r.employee);
    }
    return names
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [rows]);

  const methodOptions = useMemo(
    () => [{ value: "all", label: "All methods" }, ...PAYMENT_METHODS],
    [],
  );

  const fundOptions = useMemo(() => {
    const funds = [];
    for (const r of rows) {
      if (r.source_of_funds && !funds.includes(r.source_of_funds)) {
        funds.push(r.source_of_funds);
      }
    }
    return funds
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ value: label, label }));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      if (r.status && !seen.has(r.status)) {
        seen.set(r.status, STATUS[r.status]?.label ?? r.status);
      }
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // The API only supports `search`; the four dropdown filters run client-side
  // before pagination so page counts stay accurate.
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (employee === "all" || r.employee === employee) &&
          (method === "all" || r.method === method) &&
          (fund === "all" || r.source_of_funds === fund) &&
          (status === "all" || r.status === status),
      ),
    [rows, employee, method, fund, status],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  // Clamp so a search/filter change can never land on an out-of-range page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredRows, currentPage],
  );

  const rangeStart =
    filteredRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredRows.length, (currentPage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    employee !== "all" ||
    method !== "all" ||
    fund !== "all" ||
    status !== "all";

  const clearFilters = () => {
    updateSearch("");
    updateEmployee("all");
    updateMethod("all");
    updateFund("all");
    updateStatus("all");
  };

  return (
    <Card padding="md">
      <CardHeader>
        <div>
          <CardTitle className="text-lg">Budget Issued Transactions</CardTitle>
          <CardDescription>
            Track and manage all budget issuances to employees.
          </CardDescription>
        </div>
      </CardHeader>

      <div>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[168px]">
              <Listbox
                options={employeeOptions}
                value={employee}
                onChange={updateEmployee}
                placeholder="All Employee"
                buttonClassName="h-9"
              />
            </div>
            <div className="w-[168px]">
              <Listbox
                options={methodOptions}
                value={method}
                onChange={updateMethod}
                placeholder="All methods"
                buttonClassName="h-9"
              />
            </div>
            <div className="w-[168px]">
              <Listbox
                options={fundOptions}
                value={fund}
                onChange={updateFund}
                placeholder="All Source Funds"
                buttonClassName="h-9"
              />
            </div>
            <div className="w-[168px]">
              <Listbox
                options={statusOptions}
                value={status}
                onChange={updateStatus}
                placeholder="All Status"
                buttonClassName="h-9"
              />
            </div>
          </div>
          <div className="lg:ml-auto lg:w-[320px]">
            <SearchInput
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder="Search..."
              aria-label="Search issued transactions"
              leftIcon={<Search size={16} strokeWidth={2} />}
              className="w-full md:w-80"
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState refetch={refetch} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
          />
        ) : (
          <>
            {/* Desktop — semantic table with fixed column proportions */}
            <div
              className="hidden overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 md:block"
              tabIndex={0}
              aria-label="Budget issued transactions"
            >
              <table className="w-full min-w-[960px] table-fixed border-collapse text-left">
                <caption className="sr-only">
                  Budget issued transactions with employee, description, notes,
                  amount, payment method, source of funds, date issued, and
                  status
                </caption>
                <colgroup>
                  {COLUMN_WIDTHS.map((width, i) => (
                    <col key={i} style={{ width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-[var(--surface-2)]/60">
                    {HEADERS.map((h) => (
                      <th
                        key={h.label}
                        scope="col"
                        className={cn(
                          "border-b border-[var(--border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] first:pl-5 last:pr-5",
                          {
                            "text-left": h.align === "left",
                            "text-center": h.align === "center",
                            "text-right": h.align === "right",
                          },
                        )}
                      >
                        <span
                          className={h.srOnly ? "sr-only" : "whitespace-nowrap"}
                        >
                          {h.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => (
                    <BudgetIssuedRow key={t.id} transaction={t} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — stacked transaction cards */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {pageRows.map((t) => (
                <BudgetIssuedCard key={t.id} transaction={t} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                Showing {rangeStart}–{rangeEnd} of {rows.length}{" "}
                {rows.length === 1 ? "transaction" : "transactions"}
              </p>

              {pageCount > 1 && (
                <nav
                  aria-label="Pagination"
                  className="flex items-center gap-1.5"
                >
                  <PagerButton
                    label="Previous page"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </PagerButton>
                  {pageItems(pageCount, currentPage).map((item, i) =>
                    item === "…" ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-1 text-xs text-[var(--ink-muted)]"
                      >
                        …
                      </span>
                    ) : (
                      <PagerButton
                        key={item}
                        label={`Page ${item + 1}`}
                        active={item === currentPage}
                        onClick={() => setPage(item)}
                      >
                        {item + 1}
                      </PagerButton>
                    ),
                  )}
                  <PagerButton
                    label="Next page"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={14} />
                  </PagerButton>
                </nav>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default BudgetIssuedTransaction;
