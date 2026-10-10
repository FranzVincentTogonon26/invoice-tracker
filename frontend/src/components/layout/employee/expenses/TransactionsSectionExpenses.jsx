import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import {
  CircleCheck,
  Inbox,
  Layers,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { EXPENSES_PAGE_SIZE, USER_ROLES } from "@/constants";
import {
  filterExpenseSectionTransactions,
  groupExpenseTransactionsByDate,
} from "@/lib/expenseLedger";
import {
  emptyDateRange,
  formatDate,
  formatDateRange,
  formatMoney,
} from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useExpensesMutations } from "@/hooks/useExpenses";
import { Card } from "../../../ui/Card";
import { SearchInput } from "../../../ui/Input";
import { Pager } from "../../../ui/Pager";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import DateRangePicker from "../../../ui/DateRangePicker";
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import EmployeeExpenseDetailsModal from "./EmployeeExpenseDetailsModal";
import { ExpenseSectionTable } from "./ExpenseSectionTable";
import { ExpenseSectionMobileList } from "./ExpenseSectionMobileList";
import { ExpenseTransactionSheet } from "./ExpenseTransactionSheet";

export const TransactionsSectionExpenses = ({
  transactions = [],
  isLoading = false,
  onTransactionUpdate,
  // Admin → Employee Details renders the section as a read-only record view:
  // no soft delete, no inline description editing.
  readOnly = false,
  // Reimbursement-originated details view (`…/employees/:id/reimbursement`):
  // hides the admin "Add to draft" / "Restore from draft" row actions — the
  // record is reviewed/settled from the reimbursement ledger instead.
  // Defaults off so the employee pages and the overview details view keep
  // the draft lifecycle.
  hideDraftActions = false,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [sheetRow, setSheetRow] = useState(null);
  // Pending admin draft move: { row, to: "draft" | "paid" } — one shared
  // confirm flow serves both directions (see runDraftMove).
  const [draftRow, setDraftRow] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const qc = useQueryClient();
  const { setStatus, markEmployeeDraft, markEmployeePaid } =
    useExpensesMutations();
  const confirmPending =
    setStatus.isPending ||
    markEmployeeDraft.isPending ||
    markEmployeePaid.isPending;

  const closeConfirm = () => {
    if (!confirmPending) setDeleteRow(null);
  };

  const runMarkDraft = async () => {
    if (!deleteRow) return;

    try {
      await setStatus.mutateAsync({ id: deleteRow.id, status: "draft" });
      toast.success("Expense moved to draft");
      setDeleteRow(null);
      setSheetRow(null);
    } catch (err) {
      toast.error(err?.message || "Couldn’t move expense to draft");
    }
  };

  // Shared function between "Add to draft" (paid → draft) and "Restore from
  // draft" (draft → paid): the pending `draftRow.to` decides which admin
  // endpoint runs. Both endpoints are admin-only and guarded server-side to
  // employee-authored rows. The admin details queries (["employeeDetails", …])
  // sit outside the shared hook's invalidation, so they are refreshed here
  // explicitly and the row updates without a manual reload.
  const runDraftMove = async () => {
    if (!draftRow) return;

    try {
      if (draftRow.to === "draft") {
        await markEmployeeDraft.mutateAsync(draftRow.row.id);
        toast.success("Expense moved to draft");
      } else {
        await markEmployeePaid.mutateAsync(draftRow.row.id);
        toast.success("Expense restored to paid");
      }
      qc.invalidateQueries({ queryKey: ["employeeDetails"] });
      setDraftRow(null);
      setSheetRow(null);
    } catch (err) {
      toast.error(err?.message || "Couldn’t update expense");
    }
  };

  const closeDraftConfirm = () => {
    if (!markEmployeeDraft.isPending && !markEmployeePaid.isPending)
      setDraftRow(null);
  };

  const draftSummary = draftRow ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {draftRow.row.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${draftRow.row.category || "Uncategorized"} · ${formatDate(draftRow.row.date)}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(draftRow.row.amount)}
      </span>
    </div>
  ) : null;

  const draftCopy =
    draftRow?.to === "paid"
      ? {
          icon: <CircleCheck size={20} aria-hidden />,
          iconClassName: "bg-[var(--success)]/12 text-[var(--success)]",
          title: "Restore this expense from draft?",
          description:
            "The record leaves Draft and counts against the employee's balance again — exactly as it did before it was parked there.",
          cancelLabel: "Keep as draft",
          confirmLabel: "Yes, mark as paid",
          confirmVariant: "accent",
          pendingLabel: "Restoring…",
        }
      : {
          icon: <RotateCcw size={20} aria-hidden />,
          title: "Add this expense to draft?",
          description:
            "The record stays in the employee's ledger, but its status moves back to Draft — only paid expenses count against the employee's balance, so this amount returns to their available balance until it is paid again.",
          cancelLabel: "Keep as paid",
          confirmLabel: "Yes, move to draft",
          confirmVariant: "danger",
          pendingLabel: "Moving…",
        };

  const confirmSummary = deleteRow ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {deleteRow.description || "Untitled expense"}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
          {`${deleteRow.category || "Uncategorized"} · ${formatDate(deleteRow.date)}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ink)]">
        {formatMoney(deleteRow.amount)}
      </span>
    </div>
  ) : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredTransactions = useMemo(
    () =>
      filterExpenseSectionTransactions(
        transactions,
        debouncedSearch,
        dateRange,
      ),
    [transactions, debouncedSearch, dateRange],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / EXPENSES_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      filteredTransactions.slice(
        currentPage * EXPENSES_PAGE_SIZE,
        (currentPage + 1) * EXPENSES_PAGE_SIZE,
      ),
    [filteredTransactions, currentPage],
  );

  const rangeStart =
    filteredTransactions.length === 0
      ? 0
      : currentPage * EXPENSES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    (currentPage + 1) * EXPENSES_PAGE_SIZE,
    filteredTransactions.length,
  );

  return (
    <Card className="overflow-hidden px-2.5">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink)]">
            <Layers size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-medium tracking-tight text-[var(--ink)]">
                All Expenses
              </h3>
            </div>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Monitor spending and expenses.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-1 items-center gap-2 md:max-w-2xl">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            placeholder="Search..."
            aria-label="Search Expenses"
            className="min-w-0 flex-1"
            rightSlot={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null
            }
          />
          <DateRangePicker
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setPage(0);
            }}
            placeholder="All dates"
            align="end"
            compactOnMobile
          />
        </div>
      </div>

      <div className="hidden md:block mt-4">
        {isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              debouncedSearch
                ? "No matching transactions"
                : hasDateRange
                  ? "No transactions in this range"
                  : "No transactions found"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No transactions matched "${debouncedSearch}". Try clearing your search.`
                    : "No budget issuances, expenses, or abono records yet."
            }
          />
        ) : (
          <ExpenseSectionTable
            rows={pageRows}
            pending={confirmPending}
            onView={setViewRow}
            onDelete={setDeleteRow}
            canDelete={!readOnly}
            canManageDraft={isAdmin && !hideDraftActions}
            onAddToDraft={(row) => setDraftRow({ row, to: "draft" })}
            onRestoreFromDraft={(row) => setDraftRow({ row, to: "paid" })}
          />
        )}
      </div>

      <div className="block md:hidden mt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-[var(--surface-2)]" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
                    <div className="h-2.5 w-20 rounded bg-[var(--surface-2)]" />
                  </div>
                </div>
                <div className="h-4 w-16 rounded bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              debouncedSearch
                ? "No matching transactions"
                : hasDateRange
                  ? "No transactions in this range"
                  : "No transactions found"
            }
            description={
              debouncedSearch && hasDateRange
                ? `Nothing in ${formatDateRange(dateRange)} matched "${debouncedSearch}".`
                : hasDateRange
                  ? `Nothing was recorded in ${formatDateRange(dateRange)}. Try a wider range.`
                  : debouncedSearch
                    ? `No transactions matched "${debouncedSearch}".`
                    : "No transactions recorded yet."
            }
          />
        ) : (
          <ExpenseSectionMobileList
            groups={groupExpenseTransactionsByDate(pageRows)}
            disabled={confirmPending}
            onOpen={setSheetRow}
          />
        )}
      </div>

      {!isLoading && filteredTransactions.length > EXPENSES_PAGE_SIZE && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-[var(--ink-muted)]">
            Showing {rangeStart}–{rangeEnd} of {filteredTransactions.length}{" "}
            transactions
          </p>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      <EmployeeExpenseDetailsModal
        open={Boolean(viewRow)}
        expense={viewRow}
        onClose={() => setViewRow(null)}
      />

      <ExpenseTransactionSheet
        row={sheetRow}
        pending={confirmPending}
        onClose={() => setSheetRow(null)}
        onView={setViewRow}
        onDelete={setDeleteRow}
        onUpdate={(updatedRow) => {
          setSheetRow(updatedRow);
          // Let the page replace its local row so the ledger reflects the edit
          onTransactionUpdate?.(updatedRow);
        }}
        canManage={!readOnly}
        canEdit={!readOnly}
      />

      <ConfirmActionDialog
        open={Boolean(deleteRow)}
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this expense?"
        description="Nothing is permanently removed — the expense is kept as a Draft, but it will no longer show in your expense list."
        summary={confirmSummary}
        cancelLabel="Keep expense"
        confirmLabel="Yes, delete it"
        pendingLabel="Deleting…"
        pending={confirmPending}
        onCancel={closeConfirm}
        onConfirm={runMarkDraft}
      />

      <ConfirmActionDialog
        open={Boolean(draftRow)}
        icon={draftCopy.icon}
        iconClassName={draftCopy.iconClassName}
        title={draftCopy.title}
        description={draftCopy.description}
        summary={draftSummary}
        cancelLabel={draftCopy.cancelLabel}
        confirmLabel={draftCopy.confirmLabel}
        confirmVariant={draftCopy.confirmVariant}
        pendingLabel={draftCopy.pendingLabel}
        pending={markEmployeeDraft.isPending || markEmployeePaid.isPending}
        onCancel={closeDraftConfirm}
        onConfirm={runDraftMove}
      />
    </Card>
  );
};

export default TransactionsSectionExpenses;
