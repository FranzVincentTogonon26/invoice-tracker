import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "../api/expenses";

/* ── Expenses ──────────────────────────────────────────────────── */
export const expensesKey = (params) => ["expenses", params || {}];

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
  };
  return {
    // Saves expense lines / adds a category / saves a receipt — dispatched by
    // the `type` field in the payload.
    create: useMutation({
      mutationFn: expensesApi.create,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: expensesApi.remove,
      onSuccess: invalidate,
    }),
    // Deletes a category (UNIQUE-style feedback comes back as a 409).
    removeCategory: useMutation({
      mutationFn: expensesApi.removeCategory,
      onSuccess: invalidate,
    }),
  };
}
