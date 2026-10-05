import { useEffect, useMemo, useState } from "react";
import { Inbox, RotateCcw, Search, X } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/Input";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/DataState";
import { Pager } from "../../components/ui/Pager";
import Listbox from "../../components/ui/Listbox";
import { DatePicker } from "../../components/ui/DatePicker";
import { useAuditLogs } from "../../hooks/useAuditLogs";
import { cn } from "../../lib/utils";

// Server-side page size — the API paginates the parsed log file.
const PAGE_SIZE = 500;

const ACTION_COLORS = {
  create: "text-[var(--success)]",
  update: "text-[var(--accent-strong)]",
  delete: "text-[var(--danger)]",
  status: "text-[var(--warning)]",
  settle: "text-[var(--success)]",
  transfer: "text-[var(--accent-strong)]",
};

const toLabel = (value) =>
  String(value ?? "")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "—";

// `2026-10-05T14:32:11.000Z` (UTC, as stored) -> `10-05 22:32:11` in the
// DEVICE's local timezone — the log file stays on UTC (one unambiguous
// clock for back-tracing across devices) while what you read matches the
// clock on the device in your hand.
const shortTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return String(iso ?? "")
      .slice(5, 19)
      .replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function FilterListbox({ label, value, options, onChange, width }) {
  return (
    <div className={width}>
      <Listbox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={label}
        renderTrigger={(selectedOption) => (
          <span className="truncate text-xs text-[var(--ink-muted)]">
            {selectedOption ? (
              <span className="font-semibold">{selectedOption.label}</span>
            ) : (
              label
            )}
          </span>
        )}
        renderOption={(option) => (
          <span className="truncate flex-1">{option.label}</span>
        )}
      />
    </div>
  );
}

// Relative-day tag for the end of each row — Today / Yesterday / Last days
// by calendar day on the viewing device (same convention as the employee
// budget ledger).
const dayLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const atMidnight = (x) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const diff = Math.round(
    (atMidnight(new Date()) - atMidnight(d)) / (24 * 60 * 60 * 1000),
  );
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Last days";
};

const DAY_STYLES = {
  Today: "text-[var(--success)]",
  Yesterday: "text-[var(--warning)]",
  "Last days": "text-[var(--ink-muted)]",
};

function LogLine({ entry }) {
  const day = dayLabel(entry.timestamp);
  return (
    <div className="flex gap-x-3 px-5 py-2.5 font-mono text-xs leading-relaxed hover:bg-[var(--surface-2)]">
      <span
        className="shrink-0 tabular-nums text-[var(--ink-muted)]"
        title={entry.timestamp}
      >
        {entry.display ?? shortTime(entry.timestamp)}
      </span>
      <span
        className={cn(
          "shrink-0 font-bold uppercase",
          ACTION_COLORS[entry.action] ?? "text-[var(--ink-muted)]",
        )}
      >
        {entry.action}
      </span>
      <span className="shrink-0 text-[var(--accent-strong)]">
        {entry.entity}
      </span>
      <span className="shrink-0 max-w-[160px] truncate text-[var(--ink)]">
        {entry.actorName}
        <span className="text-[var(--ink-muted)]"> ({entry.role})</span>
      </span>
      {entry.amount && (
        <span className="shrink-0 tabular-nums font-semibold text-[var(--success)]">
          {entry.amount}
        </span>
      )}
      <span className="min-w-0 flex-1 break-words text-[var(--ink-muted)]">
        {entry.details}
      </span>
      {day && (
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1.5 ",
            DAY_STYLES[day] ?? "text-[var(--ink-muted)]",
          )}
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
          />
          {day}
        </span>
      )}
    </div>
  );
}

export default function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [role, setRole] = useState("all");
  // Zero-based for Pager; the API speaks 1-based (page + 1).
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const resetPage = () => setPage(0);

  // Nests under ["auditLogs", …] — the realtime bridge invalidates that root
  // on every money event, so new rows stream in with no manual refresh.
  // `tz` is the device offset in minutes ahead of UTC — the API uses it so
  // the From/To day window and "today" line up with this device's calendar,
  // not UTC's.
  const params = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      action: action === "all" ? undefined : action,
      entity: entity === "all" ? undefined : entity,
      role: role === "all" ? undefined : role,
      tz: -new Date().getTimezoneOffset(),
      page: page + 1,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, from, to, action, entity, role, page],
  );

  const { logs, total, pageCount, facets, isLoading, error, refetch } =
    useAuditLogs(params);

  // Live 0-based window for the footer counter.
  const serverPage = Math.min(page, Math.max(0, pageCount - 1));
  const rangeStart = total === 0 ? 0 : serverPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (serverPage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    from !== "" ||
    to !== "" ||
    action !== "all" ||
    entity !== "all" ||
    role !== "all";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFrom("");
    setTo("");
    setAction("all");
    setEntity("all");
    setRole("all");
    setPage(0);
  };

  const actionOptions = useMemo(
    () => [
      { value: "all", label: "All actions" },
      ...facets.actions.map((value) => ({ value, label: toLabel(value) })),
    ],
    [facets.actions],
  );
  const entityOptions = useMemo(
    () => [
      { value: "all", label: "All entities" },
      ...facets.entities.map((value) => ({ value, label: toLabel(value) })),
    ],
    [facets.entities],
  );
  const roleOptions = useMemo(
    () => [
      { value: "all", label: "All roles" },
      { value: "admin", label: "Admin" },
      { value: "employee", label: "Employee" },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Audit Logs"
        description="backend/logs/transactions.md — newest first, times in your device's local time, streaming live."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              </span>
              Live
            </span>
            {hasActiveFilters && (
              <Button variant="outline" size="md" onClick={clearFilters}>
                <RotateCcw size={14} /> Clear
              </Button>
            )}
          </div>
        }
      />

      {/* Single-row filter bar — search + dates + dropdowns inline */}
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            leftIcon={<Search size={16} />}
            placeholder="Search details, actor, amount…"
            aria-label="Search audit logs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            rightSlot={
              search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    resetPage();
                  }}
                  aria-label="Clear search"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <X size={14} />
                </button>
              ) : null
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
          <div className="min-w-0 sm:w-[150px]">
            <DatePicker
              value={from}
              onChange={(next) => {
                setFrom(next || "");
                resetPage();
              }}
              placeholder="From date"
            />
          </div>
          <div className="min-w-0 sm:w-[150px]">
            <DatePicker
              value={to}
              onChange={(next) => {
                setTo(next || "");
                resetPage();
              }}
              placeholder="To date"
            />
          </div>
          <FilterListbox
            label="All actions"
            value={action}
            options={actionOptions}
            onChange={(value) => {
              setAction(value);
              resetPage();
            }}
            width="w-full sm:w-[150px]"
          />
          <FilterListbox
            label="All entities"
            value={entity}
            options={entityOptions}
            onChange={(value) => {
              setEntity(value);
              resetPage();
            }}
            width="w-full sm:w-[150px]"
          />
          <FilterListbox
            label="All roles"
            value={role}
            options={roleOptions}
            onChange={(value) => {
              setRole(value);
              resetPage();
            }}
            width="w-full sm:w-[140px]"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] sm:col-auto sm:w-auto"
            >
              <RotateCcw size={13} aria-hidden />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Terminal — theme-aware: follows data-theme (light console in
          light mode, dark console in dark mode) instead of fixed colors. */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div className="py-1.5">
          {isLoading ? (
            <div className="px-3 py-1 font-mono text-[11px] text-[var(--ink-muted)]">
              <LoadingSkeleton rows={6} />
            </div>
          ) : error ? (
            <div className="px-3 py-4">
              <ErrorState
                title="Couldn't load audit logs"
                message="Something went wrong while reading the transaction log."
                onRetry={refetch}
                onClearFilters={hasActiveFilters ? clearFilters : undefined}
              />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-3 py-4">
              <EmptyState
                icon={Inbox}
                title={
                  hasActiveFilters
                    ? "No log entries match your filters"
                    : "No audit entries yet"
                }
                message={
                  hasActiveFilters
                    ? "Try a wider date range or different filters."
                    : "Logged transactions and account activity will stream in here."
                }
                onClear={hasActiveFilters ? clearFilters : undefined}
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {logs.map((entry) => (
                <LogLine key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        {!isLoading && !error && logs.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2 sm:flex-row sm:items-center">
            <p className="font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
              {rangeStart}–{rangeEnd} of {total.toLocaleString()}
            </p>
            {pageCount > 1 && (
              <div className="sm:ml-auto">
                <Pager
                  page={serverPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
