import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "../api/expenses";

/* ── Expenses ──────────────────────────────────────────────────── */
export const expensesKey = (params) => ["expenses", params || {}];

/* ── Expense detail (View expense modal) ─────────────────────────── */

// One saved expense + its scanned receipt lines, fetched on demand when the
// View expense modal opens — the list only carries what the table shows, so
// the line items travel here instead of bloating every ledger row.
export function useExpenseDetail(id, options = {}) {
  const query = useQuery({
    queryKey: ["expenses", "detail", id || null],
    queryFn: () => expensesApi.detail(id),
    enabled: Boolean(id),
    ...options,
  });

  return {
    ...query,
    expense: query.data?.expense ?? null,
    receiptItems: query.data?.receiptItems ?? [],
    vendor: query.data?.vendor ?? "",
  };
}

export function useExpenses(params, options = {}) {
  const query = useQuery({
    queryKey: expensesKey(params),
    queryFn: () => expensesApi.list(params),
    // Extra options let a caller tune a window against the same endpoint
    // (e.g. disable it until the window is actually known).
    ...options,
  });

  // The API returns `{ expenses, categories, overview, gemini_model }` with an
  // empty-reference default for every field, so consumers never crash while
  // loading or after a failure — `data` stays the raw payload.
  return {
    ...query,
    expenses: query.data?.expenses ?? [],
    categories: query.data?.categories ?? [],
    references: query.data?.references ?? [],
    // Employee-only: MIN(budget_issued_reference.created_at) for the signed-in
    // user as YYYY-MM-DD — the first date budget was issued to them. `null` for
    // admins (the endpoint never sends it) and for employees without an
    // issuance. Add Expenses compares each line's date against this and warns
    // on the ones behind it; the backend stores those with `flag = 1`.
    firstIssuedAt: query.data?.firstIssuedAt ?? null,
    // Rows from the `geminimodel` table — `ModelSource` maps them into the
    // "Source" Listbox of the Scan Receipt panel.
    geminiModel: query.data?.gemini_model ?? [],
    overview: query.data?.overview ?? {
      totalExpenses: 0,
      thisMonth: 0,
      totalTransactions: 0,
      totalCategories: 0,
    },
  };
}

export function useExpensesMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    // The employee ledger lives under its own key (see useEmployeeExpenses)
    // and must refresh too when a row is saved or deleted from it.
    qc.invalidateQueries({ queryKey: ["employeeExpenses"] });
    // Admin employee-details views (overview/budget/expenses/abono tabs and
    // the reimbursement details checklist) read through this key.
    qc.invalidateQueries({ queryKey: ["employeeDetails"] });
  };
  return {
    // Saves expense lines / adds a category / saves a receipt — dispatched by
    // the `type` field in the payload.
    create: useMutation({
      mutationFn: expensesApi.create,
      onSuccess: invalidate,
    }),
    // Deferred receipt upload (Add Expenses "Save expenses"): every receipt
    // file the form still holds goes up in ONE request, so the images reach
    // `uploads/receipts` only after the save is confirmed. No cache work here
    // — the response is just URLs consumed by the save that calls this.
    uploadReceiptImages: useMutation({
      mutationFn: expensesApi.uploadReceiptImages,
    }),
    remove: useMutation({
      mutationFn: expensesApi.remove,
      onSuccess: invalidate,
    }),
    // Soft delete: keeps the row and only flips its status — the employee
    // ledger's "Delete expense" parks the record back in 'draft' through this.
    setStatus: useMutation({
      mutationFn: ({ id, status }) => expensesApi.updateStatus(id, status),
      onSuccess: invalidate,
    }),
    // Admin ledger row action ("Add to draft"): pushes an employee-authored
    // paid expense back to 'draft' — the amount returns to the employee's
    // available balance, which is why the employee ledger refreshes too.
    markEmployeeDraft: useMutation({
      mutationFn: expensesApi.markEmployeeDraft,
      onSuccess: invalidate,
    }),
    // Admin ledger row action ("Remove from draft"): the counterpart — an
    // employee-authored draft goes back to 'paid' and counts against that
    // employee's balance again.
    markEmployeePaid: useMutation({
      mutationFn: expensesApi.markEmployeePaid,
      onSuccess: invalidate,
    }),
    // Admin approval for a flagged expense ("Approve flag" inside the
    // flaggedNotice): clears `expenses.flag` back to 0 — the red notice
    // unmounts once the ledger refetches.
    clearFlag: useMutation({
      mutationFn: expensesApi.clearFlag,
      onSuccess: invalidate,
    }),
    // Admin review notes (ExpenseDetailsModal draft card);
    // `updateNotes({ id, notes })` — blank clears the trail.
    updateNotes: useMutation({
      mutationFn: ({ id, notes }) => expensesApi.updateNotes(id, notes),
      onSuccess: invalidate,
    }),
    // Deletes a category (UNIQUE-style feedback comes back as a 409).
    removeCategory: useMutation({
      mutationFn: expensesApi.removeCategory,
      onSuccess: invalidate,
    }),
    // Reimbursement review checklist: mark one expense row reviewed ('yes')
    // or reopen it ('no'). Ticks save instantly — no draft state.
    setReview: useMutation({
      mutationFn: ({ id, review }) => expensesApi.setReview(id, review),
      onSuccess: invalidate,
    }),
  };
}
