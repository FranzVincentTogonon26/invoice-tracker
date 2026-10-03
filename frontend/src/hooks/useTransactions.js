import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsApi } from "../api/transactions";
import { budgetsApi } from "../api/budget";
import { expensesApi } from "../api/expenses";
import { abonoApi } from "../api/abono";
import { budgetTransferApi } from "../api/budget-transfer";

export const transactionsKey = (params) => ["transactions", params || {}];

// Unified admin ledger: every money movement (budget given, budget issued,
// expenses, abono, transfer sent/received legs) normalized to one list plus
// the all-time gross summary and the category / reference filter lists.
// The API returns `{ transactions, summary, categories, references }` —
// everything resolves to an empty default while loading or after a failure
// so consumers never crash on missing data.
export function useTransactions(params, options = {}) {
  const query = useQuery({
    queryKey: transactionsKey(params),
    queryFn: () => transactionsApi.list(params),
    ...options,
  });

  return {
    ...query,
    transactions: query.data?.transactions ?? [],
    summary: query.data?.summary ?? {
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
      count: 0,
      byKind: {},
    },
    categories: query.data?.categories ?? [],
    references: query.data?.references ?? [],
  };
}

// Every row action the unified ledger offers, dispatched to the owning
// endpoint (budget / issued / expense / abono / transfer). A successful write
// moves money, so the shared `invalidate` refreshes the ledger alongside
// every view that shows a balance (budgets, expenses, abono, transfers and
// the employee ledgers derived from them).
export function useTransactionsMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
    qc.invalidateQueries({ queryKey: ["abono"] });
    qc.invalidateQueries({ queryKey: ["employeeAbono"] });
    qc.invalidateQueries({ queryKey: ["budgetTransfer"] });
    qc.invalidateQueries({ queryKey: ["employeeOverview"] });
    qc.invalidateQueries({ queryKey: ["employeeBudget"] });
  };

  return {
    // Budget Given row: Cancel (budget.status -> 'cancelled').
    cancelBudget: useMutation({
      mutationFn: budgetsApi.cancelTransaction,
      onSuccess: invalidate,
    }),
    // Budget Given row: undo a cancellation — restores 'added'.
    restoreBudget: useMutation({
      mutationFn: ({ id, status }) =>
        budgetsApi.restoreTransaction(id, status),
      onSuccess: invalidate,
    }),
    // Budget Issued row: flip the parent reference to 'cancel'.
    cancelIssued: useMutation({
      mutationFn: budgetsApi.cancelIssuedTransaction,
      onSuccess: invalidate,
    }),
    // Budget Issued row: undo an issuance cancellation — restores 'open'.
    restoreIssued: useMutation({
      mutationFn: ({ id, status }) =>
        budgetsApi.restoreIssuedTransaction(id, status),
      onSuccess: invalidate,
    }),
    // Expense row: hard delete.
    removeExpense: useMutation({
      mutationFn: expensesApi.remove,
      onSuccess: invalidate,
    }),
    // Expense row: park an employee-authored paid/cancelled row in 'draft'.
    markExpenseDraft: useMutation({
      mutationFn: expensesApi.markEmployeeDraft,
      onSuccess: invalidate,
    }),
    // Expense row: put an employee-authored draft back to 'paid'.
    markExpensePaid: useMutation({
      mutationFn: expensesApi.markEmployeePaid,
      onSuccess: invalidate,
    }),
    // Expense row: void the record (status -> 'cancel').
    cancelExpense: useMutation({
      mutationFn: ({ id, status }) => expensesApi.updateStatus(id, status),
      onSuccess: invalidate,
    }),
    // Abono row: permanent delete (guarded server-side when already spent).
    removeAbono: useMutation({
      mutationFn: abonoApi.remove,
      onSuccess: invalidate,
    }),
    // Transfer legs: cancel the underlying transfer (both legs disappear).
    cancelTransfer: useMutation({
      mutationFn: budgetTransferApi.cancelTransfer,
      onSuccess: invalidate,
    }),
  };
}
