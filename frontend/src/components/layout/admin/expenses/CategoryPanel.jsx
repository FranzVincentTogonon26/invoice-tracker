import { BadgeCheck, Hash, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "../../../ui/Input";
import { Button } from "../../../ui/Button";
import { formatDate } from "../../../../lib/utils";

// "Expense Categories" panel: add form + scrollable table. Pure presentation —
// every mutation is owned by ExpensesModal and passed down as handlers.
// Categories referenced by expense rows (`expense_count > 0` from the API)
// show an in-use <Check /> instead of the delete <Trash2 /> action.
const CategoryPanel = ({
  categories,
  tableRef,
  newCategory,
  onNewCategoryChange,
  onSubmit,
  onDeleteCategory,
  adding,
  deletingId,
}) => (
  <>
    <form onSubmit={onSubmit} className="flex shrink-0 items-center gap-2">
      <Input
        value={newCategory}
        onChange={onNewCategoryChange}
        placeholder="New category name…"
        Icon={Hash}
        disabled={adding}
        autoFocus
      />
      <Button
        type="submit"
        variant="soft"
        size="icon"
        disabled={adding}
        aria-label="Add new category"
      >
        {adding ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Plus size={16} />
        )}
      </Button>
    </form>
    <div
      ref={tableRef}
      className="scrollbar-slim mt-5 max-h-[50vh] min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)]"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-[var(--surface-2)] type-eyebrow text-[var(--ink-muted)]">
            <th className="px-4 py-2.5 text-left font-semibold">Category</th>
            <th className="px-4 py-2.5 text-right font-semibold">
              Date Created
            </th>
            <th className="px-4 py-2.5 text-right font-semibold" />
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr
              key={category.category_id}
              className="border-t border-[var(--border)] first:border-t-0 hover:bg-[var(--surface-2)]/60 transition-colors"
            >
              <td
                title={category.category_name}
                className="max-w-[240px] truncate px-4 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                {category.category_name ?? "—"}
              </td>
              <td className="px-4 py-2 text-right text-sm text-[var(--ink-muted)] whitespace-nowrap">
                {formatDate(category.created_at)}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {category.expense_count > 0 ? (
                  // Category is referenced by expense rows — deletion would
                  // orphan those rows (ON DELETE SET NULL), so the delete
                  // action is replaced with an in-use check.
                  <span
                    title={`Used by ${category.expense_count} ${
                      category.expense_count === 1 ? "expense" : "expenses"
                    } — cannot be deleted`}
                    aria-label={`Category ${category.category_name} is in use`}
                    className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-full text-[var(--success)]"
                  >
                    <BadgeCheck size={16} strokeWidth={2.5} />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(category.category_id)}
                    disabled={adding || deletingId !== null}
                    aria-label={`Delete category ${category.category_name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {deletingId === category.category_id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]"
              >
                No categories yet — add one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </>
);

export default CategoryPanel;
