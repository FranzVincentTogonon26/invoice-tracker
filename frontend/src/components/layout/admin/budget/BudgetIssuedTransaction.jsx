import { useCallback, useEffect, useMemo, useState } from "react";
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

const PAGE_SIZE = 100;

/**
 * Dropdown predicate for the issued-transaction list — one source of truth so
 * the table (desktop and mobile) and the mobile filter sheet's live "N results"
 * preview can never disagree about what matches. "all" (or an unset value)
 * matches everything, exactly like the inline Listboxes have always behaved.
 */
const matchesIssuedFilters = (row, { employee, method, fund, status }) =>
  (employee === "all" || row.employee === employee) &&
  (method === "all" || row.method === method) &&
  (fund === "all" || row.source_of_funds === fund) &&
  (status === "all" || row.status === status);

const BudgetIssuedTransaction = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const filteredRows = useMemo(
    () =>
      rows.filter((r) =>
        matchesIssuedFilters(r, { employee, method, fund, status }),
      ),
    [rows, employee, method, fund, status],
  );

  // Live "N results" preview for the mobile filter sheet: the sheet stages its
  // own draft, so it asks the page how many rows that draft would return (the
  // search itself is applied server-side through the fetch params).
  const countIssuedMatches = useCallback(
    (draft) => rows.filter((r) => matchesIssuedFilters(r, draft)).length,
    [rows],
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
          <CardDescription className="text-sm">
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
          countMatches={countIssuedMatches}
          totalRows={rows.length}
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
              <p className="text-sm tabular-nums text-[var(--ink-muted)]">
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
