import { useEffect, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../../ui/DataState";
import { Pager } from "../../../ui/Pager";
import {
  useBudgetIssuedTransaction,
  useBudgetMutations,
} from "../../../../hooks/useBudget";
import { PAYMENT_METHODS, STATUS } from "../../../../constants";
import IssuedTransactionFilters from "./IssuedTransactionFilters";
import IssuedTransactionTable from "./IssuedTransactionTable";

// Client-side page size — the API returns the full filtered list.
const PAGE_SIZE = 100;

/**
 * Budget Issued Transactions — every budget handed out to an employee.
 * Desktop: semantic `<table>` (see `IssuedTransactionTable`) with a soft mint
 * header and generous row padding; horizontal scrolls when space is tight.
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

  // Single entry point for the filter bar (`IssuedTransactionFilters`).
  const handleFilterChange = (key, value) => {
    switch (key) {
      case "employee":
        updateEmployee(value);
        break;
      case "method":
        updateMethod(value);
        break;
      case "fund":
        updateFund(value);
        break;
      case "status":
        updateStatus(value);
        break;
      default:
        break;
    }
  };

  const { data, isLoading, error, refetch } = useBudgetIssuedTransaction({
    search: debouncedSearch.trim() || undefined,
  });

  const { cancelIssuedTransaction, restoreIssuedTransaction } =
    useBudgetMutations();

  // Row-level mutations route through here. `cancel` flips the parent
  // `budget_issued_reference.status` to 'cancel'; `restore` puts it back to
  // 'open'. Both invalidate the shared ["budgets"] cache via the hook.
  const handleAction = async (action, transaction) => {
    if (action === "restore") {
      try {
        await restoreIssuedTransaction.mutateAsync({
          id: transaction.id,
          status: "open",
        });
        toast.success("Budget issuance restored");
      } catch (err) {
        toast.error(err?.message || "Couldn't restore budget issuance");
      }
      return;
    }
    if (action !== "cancel") return;
    try {
      await cancelIssuedTransaction.mutateAsync(transaction.id);
      toast.success("Budget issuance cancelled");
    } catch (err) {
      toast.error(err?.message || "Couldn't cancel budget issuance");
    }
  };

  // The hook already resolves `data` to an array.
  const rows = useMemo(() => data ?? [], [data]);

  // ── Dropdown options (derived client-side from the loaded rows) ─────────

  const employeeOptions = useMemo(() => {
    const names = [];
    for (const r of rows) {
      if (r.employee && !names.includes(r.employee)) names.push(r.employee);
    }
    return [
      { value: "all", label: "All Employee" },
      ...names
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ];
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
    return [
      { value: "all", label: "All Source Funds" },
      ...funds
        .sort((a, b) => a.localeCompare(b))
        .map((label) => ({ value: label, label })),
    ];
  }, [rows]);

  const statusOptions = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      if (r.status && !seen.has(r.status)) {
        seen.set(r.status, STATUS[r.status]?.label ?? r.status);
      }
    }
    return [
      { value: "all", label: "All Status" },
      ...[...seen.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
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
    <Card
      padding="lg"
      className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
    >
      <CardHeader>
        <div>
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-lg">
              Budget Issued Transactions
            </CardTitle>
          </div>
          <CardDescription>
            Track and manage all budget issuances to employees.
          </CardDescription>
        </div>
      </CardHeader>

      <div>
        <IssuedTransactionFilters
          filters={{ employee, method, fund, status }}
          options={{
            employee: employeeOptions,
            method: methodOptions,
            fund: fundOptions,
            status: statusOptions,
          }}
          onFilterChange={handleFilterChange}
          search={search}
          onSearch={updateSearch}
        />

        {isLoading ? (
          <LoadingSkeleton showAvatar />
        ) : error ? (
          <ErrorState
            title="Couldn't load issued transactions"
            message="Something went wrong while fetching budget issuances."
            onRetry={refetch}
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              hasActiveFilters
                ? "No issued transactions match your search"
                : "No issued budget transactions yet"
            }
            message={
              hasActiveFilters
                ? undefined
                : "Budgets issued to employees will appear here."
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
            clearLabel="Clear search"
          />
        ) : (
          <>
            <IssuedTransactionTable rows={pageRows} onAction={handleAction} />

            {/* Pagination */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                Showing {rangeStart}–{rangeEnd} of {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "transaction" : "transactions"}
              </p>

              {pageCount > 1 && (
                <Pager
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default BudgetIssuedTransaction;
