import {
  AlertCircle,
  ArrowLeft,
  Eye,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardTitle } from "../../../ui/Card";
import { DatePicker } from "../../../ui/DatePicker";
import { Input, TextArea } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";
import { formatMoney, toISODate } from "../../../../lib/utils";
import {
  useExpenses,
  useExpensesMutations,
} from "../../../../hooks/useExpenses";
import { useExpenseSuggestion } from "../../../../hooks/useExpenseSuggestion";
import {
  clearPendingReceipts,
  readPendingReceipt,
  removePendingReceipt,
} from "../../../../lib/receiptDraft";
import ExpensesModal from "./ExpensesModal";
import ReceiptDraftModal from "./ReceiptDraftModal";

// One editable line. Kept camelCase for the form and mapped to the API's
// snake_case shape by `toPayload` — see `blankItem`/`toPayload` pairing.
const blankItem = () => ({
  description: "",
  categoryId: "",
  date: toISODate(),
  totalAmount: "",
  receiptId: "",
  receiptUrl: "",
  receiptName: "",
  // Set when the line was mapped from a confirmed scan: the whole receipt lands
  // as ONE grouped line whose `receiptId` points at a temporary localStorage
  // draft (not at a `receipt` row yet), and whose scanned date/amount stay
  // locked so the receipt's numbers can't drift.
  receiptLocal: false,
  dateLocked: false,
  amountLocked: false,
  aiSuggested: false,
});

// A line the admin hasn't touched yet — the scan mapping replaces those instead
// of leaving an empty row above the mapped ones.
const isUntouchedItem = (item) =>
  !item.description.trim() &&
  !item.categoryId &&
  !item.receiptId &&
  !(Number(item.totalAmount) > 0);

// Form line → POST /expenses item. Empty strings are dropped so the backend
// sees `undefined` instead of "" (zod would reject "" as a UUID/date).
// `receiptId` arrives already resolved: a temporary draft id is swapped for the
// real `receipt` row id in `handleSave`.
const toPayload = (item, receiptId) => ({
  description: item.description.trim(),
  category_id: item.categoryId || undefined,
  expense_date: item.date || undefined,
  total_amount: Number(item.totalAmount) || 0,
  receipt_id: receiptId || undefined,
});

// Loose name match for an AI-suggested category: "Meals & Snacks" has to find
// the stored "Meals and Snacks". Nothing close enough → "" (no category), so
// the admin picks one instead of the line landing in the wrong bucket.
const normalizeCategoryName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const matchCategoryId = (categories, suggestion) => {
  const needle = normalizeCategoryName(suggestion);
  if (!needle) return "";

  const exact = categories.find(
    (category) => normalizeCategoryName(category.category_name) === needle,
  );
  if (exact) return exact.category_id;

  const partial = categories.find((category) => {
    const name = normalizeCategoryName(category.category_name);
    return name && (name.includes(needle) || needle.includes(name));
  });

  return partial?.category_id ?? "";
};

// Confirmed scan → ONE editable line for the whole receipt ("one transaction
// as a group"). The vendor seeds the description (the AI pass below suggests a
// better wording for it), the scan's own category suggestion is pre-matched,
// and the receipt's date/grand total are copied over and locked — those numbers
// belong to the receipt. The date lock is dropped when the scan read no date.
const draftToLine = (draft, categories = []) => ({
  ...blankItem(),
  description: draft.vendor || "Scanned receipt",
  categoryId: matchCategoryId(categories, draft.suggestedCategory),
  date: draft.date || toISODate(),
  totalAmount: Number(draft.total) > 0 ? String(draft.total) : "",
  receiptId: draft.receiptId,
  receiptUrl: draft.imageUrl || "",
  receiptName: draft.vendor || "Receipt",
  receiptLocal: true,
  dateLocked: Boolean(draft.date),
  amountLocked: Number(draft.total) > 0,
});

// Applies the grouped AI suggestion to the receipt's line: the description is
// only taken when Gemini produced one, and the category must match a stored
// name — no match falls back to the scan's own suggestion, else stays empty.
const applySuggestion = (item, suggestion, categories) => ({
  ...item,
  description: suggestion.description || item.description,
  categoryId:
    matchCategoryId(categories, suggestion.category) || item.categoryId,
  aiSuggested: Boolean(suggestion.description) || item.aiSuggested,
});

function Field({ label, children, hint }) {
  return (
    <div className="block min-w-0">
      <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[12px] leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

const AddExpenses = () => {
  const nav = useNavigate();

  const [form, setForm] = useState({ items: [blankItem()] });
  // null | "category" | "scan_receipt" — drives the reused ExpensesModal.
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  // Temporary receipt draft opened from a line's "View Receipt" button.
  const [viewReceipt, setViewReceipt] = useState(null);

  // Categories power the "Select Category" Listbox straight from
  // GET /expenses, which returns them alongside the ledger.
  const { categories } = useExpenses();
  const { create } = useExpensesMutations();

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.category_id,
        label: category.category_name,
      })),
    [categories],
  );

  // id → name lookup for the summary readout (the Listbox deals in ids).
  const categoryNames = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.category_id,
          category.category_name,
        ]),
      ),
    [categories],
  );

  const items = form.items;
  const saving = create.isPending;

  // Second AI pass over a confirmed scan (POST /ai/expense-suggest): the whole
  // scan list is analyzed into ONE readable description plus the best-fit
  // category for the grouped line. A failure here is non-blocking — the mapped
  // line is already usable as it is.
  const { loading: suggesting, suggest } = useExpenseSuggestion({
    onError: (message) => toast.error(message),
  });

  /* ── line editing ────────────────────────────────────────────── */

  const setItem = (index, patch) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));

  const removeItem = (index) =>
    setForm((f) => {
      const next = f.items.filter((_, i) => i !== index);
      return { ...f, items: next.length ? next : [blankItem()] };
    });

  /* ── totals (live, as you type) ─────────────────────────────── */

  const { total, filledCount } = useMemo(() => {
    const sum = items.reduce(
      (acc, item) => acc + (Number(item.totalAmount) || 0),
      0,
    );
    const filled = items.filter((item) => item.description.trim()).length;
    return { total: sum, filledCount: filled };
  }, [items]);

  /* ── modal callbacks ─────────────────────────────────────────── */

  // A category created from the modal is auto-selected on the first line that
  // has none yet (or the last line), so the round-trip feels instant.
  const handleCategoryAdded = (category) => {
    if (!category?.category_id) return;

    setForm((f) => {
      const empty = f.items.findIndex((item) => !item.categoryId);
      const at = empty >= 0 ? empty : f.items.length - 1;
      return {
        ...f,
        items: f.items.map((item, i) =>
          i === at ? { ...item, categoryId: category.category_id } : item,
        ),
      };
    });
  };

  // The category list is refetched by the mutation; just drop the now-dangling
  // selection from any line that referenced it.
  const handleCategoryDeleted = (categoryId) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: "" } : item,
      ),
    }));

  /* ── confirmed scan → one grouped expense line ───────────────── */

  // A confirmed scan arrives here as a temporary draft (already parked in
  // localStorage by the modal). The whole receipt becomes ONE line — its scan
  // list is not exploded into separate rows — with the receipt's own date and
  // grand total copied over and locked; description and category are then
  // polished by the AI pass below.
  const handleReceiptConfirmed = async (draft) => {
    if (!draft?.receiptId) return;

    const line = draftToLine(draft, categories);

    setForm((f) => {
      // Untouched placeholder rows make way for the mapped line.
      const kept = f.items.filter((item) => !isUntouchedItem(item));
      return { ...f, items: [...kept, line] };
    });

    // ONE suggestion for the receipt as a whole (description + category). Only
    // the line still carrying this draft's id is touched, so an older scan is
    // never rewritten.
    const suggestion = await suggest({
      vendor: draft.vendor,
      date: draft.date,
      items: draft.items,
      categories: categoryOptions.map((option) => option.label),
    });

    if (!suggestion) return;

    setForm((f) => ({
      ...f,
      items: f.items.map((item) =>
        item.receiptId === draft.receiptId
          ? applySuggestion(item, suggestion, categories)
          : item,
      ),
    }));
  };

  // "View Receipt": the scanned recap (vendor, date, scan list, total). The
  // temporary draft is read back from localStorage so the details survive a
  // refresh; when it's gone the line's own copy is shown instead.
  const handleViewReceipt = (item) => {
    const draft = item.receiptId ? readPendingReceipt(item.receiptId) : null;

    setViewReceipt(
      draft ?? {
        receiptId: item.receiptId,
        vendor: item.receiptName || "",
        date: item.date || "",
        currency: "",
        items: [
          {
            description: item.description,
            quantity: 1,
            rate: Number(item.totalAmount) || 0,
            amount: Number(item.totalAmount) || 0,
          },
        ],
        itemsTotal: Number(item.totalAmount) || 0,
        total: Number(item.totalAmount) || 0,
        imageUrl: item.receiptUrl || "",
        fileName: "",
      },
    );
  };

  /* ── save ────────────────────────────────────────────────────── */

  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError("");

    const touched = items.filter(
      (item) =>
        item.description.trim() ||
        Number(item.totalAmount) > 0 ||
        item.receiptId,
    );

    if (touched.length === 0) {
      setFormError("Add at least one expense line before saving.");
      return;
    }

    const invalidIndex = items.findIndex(
      (item) => !item.description.trim() || !(Number(item.totalAmount) > 0),
    );
    if (invalidIndex >= 0) {
      setFormError(
        `Line ${invalidIndex + 1} needs a description and an amount greater than zero.`,
      );
      return;
    }

    try {
      // Lines still pointing at a temporary draft need a real `receipt` row
      // first: `expenses.receipt_id` is a foreign key, and every line of one
      // scan shares that single record (image + receipt grand total).
      const persistedReceipts = new Map();
      for (const item of items) {
        if (!item.receiptLocal || !item.receiptId) continue;
        if (persistedReceipts.has(item.receiptId)) continue;

        const draft = readPendingReceipt(item.receiptId);
        const total = Number(draft?.total) || Number(item.totalAmount) || 0;
        if (!draft || !(total > 0)) continue;

        const vendor = String(draft.vendor ?? "").trim();
        const created = await create.mutateAsync({
          type: "receipt",
          description: vendor.length >= 2 ? vendor : "Scanned receipt",
          qty: 1,
          rate: total,
          amount: total,
          image_url: draft.imageUrl || undefined,
        });

        persistedReceipts.set(item.receiptId, created?.id ?? null);
      }

      await create.mutateAsync({
        type: "expense",
        items: items.map((item) =>
          toPayload(
            item,
            item.receiptLocal
              ? persistedReceipts.get(item.receiptId)
              : item.receiptId,
          ),
        ),
      });

      // Those drafts live in the database now — the temporary copies can go.
      persistedReceipts.forEach((_, draftId) => removePendingReceipt(draftId));

      toast.success(
        `Saved ${items.length} expense line${items.length === 1 ? "" : "s"}.`,
      );
      nav("/admin/expenses");
    } catch (error) {
      setFormError(error?.message || "Couldn't save expenses.");
    }
  };
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => nav(-1)}
            aria-label="Go back"
            className="mt-1 h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] shadow-card transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
                Add Expenses
              </h2>
              <Badge tone="accent">New draft</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Log expense lines, attach receipts and keep the total in sync.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="soft"
            onClick={() => setModal("category")}
          >
            <Plus size={15} />
            Add Category
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => setModal("scan_receipt")}
          >
            <ScanLine size={15} />
            Scan receipt
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)]/50 px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)] shadow-card">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <p className="type-eyebrow text-[var(--accent-strong)]">Smart tip</p>
          <p className="truncate text-sm text-[var(--ink-muted)]">
            Scan a receipt to fill one grouped line — description, category,
            date and total.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="lg" radius="lg" className="overflow-visible">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base text-lg">
                Transactions items
              </CardTitle>
              <CardDescription className="text-sm">
                One confirmed receipt lands here as one grouped row.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {suggesting && (
                <Badge tone="accent">
                  <Loader2 size={11} className="animate-spin" />
                  Suggesting…
                </Badge>
              )}
              <Badge tone="neutral" className="tabular">
                {items.length} {items.length === 1 ? "row" : "rows"}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            {items.map((it, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-display text-[11px] font-bold tabular text-[var(--bg)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {it.description.trim() || `Expense item ${i + 1}`}
                    </p>
                    {it.receiptLocal && (
                      <Badge
                        tone="accent"
                        className="hidden shrink-0 sm:inline-flex"
                      >
                        <Sparkles size={11} />
                        {it.aiSuggested ? "AI suggested" : "From receipt"}
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    title="Remove line"
                    aria-label={`Remove expense line ${i + 1}`}
                    className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <Field
                  label="Description"
                  hint={
                    it.receiptLocal
                      ? "Suggested from the scanned receipt — edit it if it doesn't match."
                      : undefined
                  }
                >
                  <TextArea
                    value={it.description}
                    onChange={(e) =>
                      setItem(i, { description: e.target.value })
                    }
                    placeholder="e.g. Pamasahe, Malengke.."
                    rows={2}
                  />
                </Field>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px_160px]">
                  <Field
                    label="Category"
                    hint={
                      it.receiptLocal
                        ? it.categoryId
                          ? "Matched from your category list."
                          : "No category matched — pick one."
                        : undefined
                    }
                  >
                    <Listbox
                      options={categoryOptions}
                      value={it.categoryId}
                      onChange={(next) => setItem(i, { categoryId: next })}
                      placeholder="Select category"
                    />
                  </Field>
                  <Field
                    label="Date"
                    hint={
                      it.dateLocked
                        ? "From the scanned receipt — locked."
                        : undefined
                    }
                  >
                    <DatePicker
                      value={it.date}
                      onChange={(next) => setItem(i, { date: next })}
                      placeholder="Select date"
                      className="tabular"
                      disabled={it.dateLocked}
                    />
                  </Field>
                  <Field
                    label="Amount"
                    hint={
                      it.amountLocked
                        ? "The receipt's grand total — locked."
                        : undefined
                    }
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--ink-muted)]">
                        ₱
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.totalAmount}
                        onChange={(e) =>
                          setItem(i, { totalAmount: e.target.value })
                        }
                        placeholder="0.00"
                        className="pl-8 text-right font-semibold tabular"
                        disabled={it.amountLocked}
                        title={
                          it.amountLocked
                            ? "Amount is locked to the scanned receipt's grand total"
                            : undefined
                        }
                      />
                    </div>
                  </Field>
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      {it.receiptLocal ? (
                        <Sparkles size={16} />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        {it.receiptId
                          ? it.receiptLocal
                            ? "Receipt attached"
                            : it.receiptName || "Receipt attached"
                          : "No receipt attached"}
                      </p>
                      <p className="text-[12px] text-[var(--ink-muted)]">
                        {it.receiptId
                          ? it.receiptLocal
                            ? `${it.receiptName || "Scanned receipt"} · #${String(it.receiptId).slice(0, 8).toUpperCase()}`
                            : "Stored with this expense line"
                          : "PNG, JPG or WEBP · up to 2MB"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.receiptId && (
                      <Button
                        variant="soft"
                        size="sm"
                        type="button"
                        onClick={() => handleViewReceipt(it)}
                      >
                        <Eye size={13} />
                        View Receipt
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-4 py-3.5 text-sm font-semibold text-[var(--accent-strong)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40 transition-colors"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)]">
              <Plus size={14} />
            </span>
            Add line item
          </button>
        </Card>
        <div className="space-y-4 lg:sticky lg:top-4">
          <Card padding="lg" radius="lg">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base text-lg">Summary</CardTitle>
              <Badge tone="accent">{items.length} lines</Badge>
            </div>
            <div className="mt-4 rounded-2xl bg-[var(--surface-2)]/70 px-4 py-4 text-center">
              <p className="type-eyebrow text-[var(--ink-muted)]">
                Total expenses
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular tracking-tight text-[var(--ink)]">
                {formatMoney(total)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                Across {items.length} line{items.length === 1 ? "" : "s"} ·{" "}
                {filledCount} described
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-[var(--ink-muted)]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[12px] font-bold tabular">
                      {i + 1}
                    </span>
                    <span className="truncate">
                      {it.description.trim() || `Item ${i + 1}`}
                      {it.categoryId ? (
                        <span className="opacity-60">
                          {" "}
                          · {categoryNames.get(it.categoryId) ?? "Category"}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular text-[var(--ink)]">
                    {formatMoney(it.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="my-4 h-px bg-[var(--border)]" />
            <div className="flex items-start gap-2 rounded-xl bg-[var(--accent-soft)]/50 px-3 py-2.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              <Info
                size={16}
                className="mt-px shrink-0 text-[var(--accent-strong)]"
              />
              Totals update live as you type. A confirmed receipt stays attached
              to its grouped line for approval.
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--danger)]"
              >
                <AlertCircle size={14} className="mt-px shrink-0" />
                {formError}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Button
                variant="accent"
                className="w-full"
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save expenses
              </Button>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                onClick={() => {
                  // The lines (and the temporary receipts behind them) are
                  // being thrown away — don't leave the drafts behind.
                  clearPendingReceipts();
                  nav(-1);
                }}
                disabled={saving}
              >
                Discard
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ExpensesModal
        open={modal !== null}
        transaction={modal ?? "category"}
        categories={categories}
        onAdd={handleCategoryAdded}
        onDelete={handleCategoryDeleted}
        onReceiptConfirmed={handleReceiptConfirmed}
        onClose={() => setModal(null)}
      />

      <ReceiptDraftModal
        open={Boolean(viewReceipt)}
        receipt={viewReceipt}
        onClose={() => setViewReceipt(null)}
      />
    </div>
  );
};

export default AddExpenses;
