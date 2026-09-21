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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardTitle } from "../../../ui/Card";
import { DatePicker } from "../../../ui/DatePicker";
import { Input, TextArea } from "../../../ui/Input";
import Listbox from "../../../ui/Listbox";
import { formatMoney, toISODate } from "../../../../lib/utils";
import { ERROR_VISIBLE_MS } from "../../../../constants";
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
import ConfirmRemoveItemDialog from "./ConfirmRemoveItemDialog";
import ExpensesModal from "./ExpensesModal";
import ReceiptDraftModal from "./ReceiptDraftModal";
import SelectSourceFund from "./SelectSourceFund";

const blankItem = () => ({
  description: "",
  categoryId: "",
  date: toISODate(),
  totalAmount: "",
  receiptId: "",
  receiptUrl: "",
  receiptName: "",
  receiptLocal: false,
  dateLocked: false,
  amountLocked: false,
  aiSuggested: false,
});

const isUntouchedItem = (item) =>
  !item.description.trim() &&
  !item.categoryId &&
  !item.receiptId &&
  !(Number(item.totalAmount) > 0);

const missingFieldsFor = (item) => {
  const missing = [];
  if (!item.description.trim()) missing.push("description");
  if (!(Number(item.totalAmount) > 0)) missing.push("amount");
  return missing;
};

const firstIncompleteIndex = (items) =>
  items.findIndex((item) => missingFieldsFor(item).length > 0);

const toPayload = (item, receiptId) => ({
  description: item.description.trim(),
  category_id: item.categoryId || undefined,
  expense_date: item.date || undefined,
  total_amount: Number(item.totalAmount) || 0,
  receipt_id: receiptId || undefined,
});

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
  // Budget reference the draft is funded from. The Summary card owns the
  // picker; with a single open source it is selected automatically (below).
  const [referenceId, setReferenceId] = useState("");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [addItemError, setAddItemError] = useState("");
  const [removeIndex, setRemoveIndex] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  // Row awaiting a remove confirmation, plus its trash button so focus can
  // return there when the dialog is cancelled. `addLineRef` is the fallback
  // target once a row is actually removed and its own button is gone, and
  // `pendingRemoveRef` is the consume-once guard for the confirm action.
  const pendingRemoveRef = useRef(null);
  const removeTriggerRef = useRef(null);
  const addLineRef = useRef(null);
  const {
    categories,
    references,
    isLoading: referencesLoading,
  } = useExpenses();
  const { create } = useExpensesMutations();

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.category_id,
        label: category.category_name,
      })),
    [categories],
  );

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
  const { loading: suggesting, suggest } = useExpenseSuggestion({
    onError: (message) => toast.error(message),
  });

  // The add-line guard message is transient: fade it out on its own after the
  // shared 5s window so a stale warning never lingers under the button.
  useEffect(() => {
    if (!addItemError) return undefined;

    const id = setTimeout(() => setAddItemError(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [addItemError]);

  // The save-time error strip follows the same contract: it slides in beside
  // the Summary buttons and auto-fades after the shared 5s window so a stale
  // failure never sits next to "Save expenses".
  useEffect(() => {
    if (!formError) return undefined;

    const id = setTimeout(() => setFormError(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [formError]);

  const setItem = (index, patch) => {
    setAddItemError("");
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addItem = () => {
    const invalidIndex = firstIncompleteIndex(items);
    if (invalidIndex >= 0) {
      const missing = missingFieldsFor(items[invalidIndex]).join(" and ");
      setAddItemError(
        `Unable to add a line item — fill up the ${missing} on line ${
          invalidIndex + 1
        } first to proceed.`,
      );
      return;
    }
    setAddItemError("");
    setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  };

  const removeItem = (index) => {
    const removed = items[index];
    if (removed?.receiptId) removePendingReceipt(removed.receiptId);

    setForm((f) => {
      const next = f.items.filter((_, i) => i !== index);
      return { ...f, items: next.length ? next : [blankItem()] };
    });
  };

  // The trash button only asks before dropping a line that has something on it:
  // dropping a filled line also drops the receipt draft parked for it, and a
  // stray tap used to cost the whole line. A line whose description is still
  // blank has nothing to confirm, so it goes straight away — `removeItem` runs
  // from here or from `confirmRemoveItem`.
  //
  // The pending index also lives in a ref: AnimatePresence keeps the dialog
  // mounted (with its frozen props) for the exit animation, so a double-click
  // would otherwise re-run the handler with the stale index and eat the line
  // that shifted into that slot.
  const requestRemoveItem = (index, trigger) => {
    const line = items[index];

    // Blank description = nothing typed, nothing worth a confirmation.
    if (!line?.description?.trim()) {
      removeItem(index);
      // The row (and its trash button) is gone — park focus on a stable control.
      addLineRef.current?.focus();
      return;
    }

    removeTriggerRef.current = trigger ?? null;
    pendingRemoveRef.current = index;
    setRemoveIndex(index);
  };

  const cancelRemoveItem = useCallback(() => {
    pendingRemoveRef.current = null;
    setRemoveIndex(null);
    removeTriggerRef.current?.focus?.();
    removeTriggerRef.current = null;
  }, []);

  const confirmRemoveItem = () => {
    const index = pendingRemoveRef.current;
    if (index == null) return;
    pendingRemoveRef.current = null;
    removeItem(index);
    setRemoveIndex(null);
    removeTriggerRef.current = null;
    // The row (and its trash button) is gone — park focus on a stable control.
    addLineRef.current?.focus();
  };

  // Line the dialog is asking about (null while it's closed).
  const removingLine =
    removeIndex == null ? null : (items[removeIndex] ?? null);

  const { total, filledCount } = useMemo(() => {
    const sum = items.reduce(
      (acc, item) => acc + (Number(item.totalAmount) || 0),
      0,
    );
    const filled = items.filter((item) => item.description.trim()).length;
    return { total: sum, filledCount: filled };
  }, [items]);

  // The Summary card funds the lines from one budget reference. With a single
  // open source there is nothing to pick, so it is used automatically — the
  // same fallback `SelectSourceFund` renders, mirrored here so the value this
  // form holds always matches the card (including after a source is removed).
  const selectedReferenceId = useMemo(() => {
    if (references.length === 1) return references[0].reference_id;
    return references.some((ref) => ref.reference_id === referenceId)
      ? referenceId
      : "";
  }, [references, referenceId]);

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

  const handleCategoryDeleted = (categoryId) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: "" } : item,
      ),
    }));

  const handleReceiptConfirmed = async (draft) => {
    if (!draft?.receiptId) return;
    const line = draftToLine(draft, categories);
    setForm((f) => {
      const kept = f.items.filter((item) => !isUntouchedItem(item));
      return { ...f, items: [...kept, line] };
    });
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

  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError("");
    setAddItemError("");
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
    const invalidIndex = firstIncompleteIndex(items);
    if (invalidIndex >= 0) {
      setFormError(
        `Line ${invalidIndex + 1} needs a description and an amount greater than zero.`,
      );
      return;
    }
    try {
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
        // Funding source — empty string normalizes to NULL on the server, so
        // nothing is saved when no reference is available/picked.
        reference_id: selectedReferenceId || undefined,
        items: items.map((item) =>
          toPayload(
            item,
            item.receiptLocal
              ? persistedReceipts.get(item.receiptId)
              : item.receiptId,
          ),
        ),
      });
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
        <div className="flex flex-wrap items-center gap-2 justify-end">
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
                  Suggesting description..
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
                    onClick={(e) => requestRemoveItem(i, e.currentTarget)}
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

                  <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                    {it.receiptId && (
                      <Button
                        variant="soft"
                        size="sm"
                        type="button"
                        onClick={() => handleViewReceipt(it)}
                        className="w-full sm:w-auto"
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
            ref={addLineRef}
            type="button"
            onClick={addItem}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-4 py-3.5 text-sm font-semibold text-[var(--accent-strong)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/40 transition-colors"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)]">
              <Plus size={14} />
            </span>
            Add line item
          </button>

          <AnimatePresence initial={false}>
            {addItemError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto", marginTop: 12 }}
                exit={{
                  opacity: 0,
                  y: -4,
                  height: 0,
                  marginTop: 0,
                  transition: { duration: 0.25, ease: "easeOut" },
                }}
                className="mt-3 flex items-start gap-2 overflow-hidden rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-sm leading-snug text-[var(--danger)]"
              >
                <AlertCircle size={17} className="mt-px shrink-0" />
                {addItemError}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card padding="lg" radius="lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription>
                  Funding, totals and the lines about to be saved.
                </CardDescription>
              </div>
              <Badge tone="accent" className="shrink-0 tabular">
                {items.length} line{items.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {/* Headline number for the draft */}
            <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
              <p className="type-eyebrow text-[var(--accent-strong)]">
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

            {/* Source of funds — its balance, what these lines leave behind and
                whether the source still covers them. */}
            <div className="mt-4">
              <SelectSourceFund
                references={references}
                value={selectedReferenceId}
                onChange={setReferenceId}
                total={total}
                disabled={saving}
                loading={referencesLoading}
              />
            </div>

            <div className="mt-4 space-y-1">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="-mx-2 flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-[var(--surface-2)]/70"
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

            <AnimatePresence initial={false}>
              {formError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto", marginTop: 16 }}
                  exit={{
                    opacity: 0,
                    y: -4,
                    height: 0,
                    marginTop: 0,
                    transition: { duration: 0.25, ease: "easeOut" },
                  }}
                  className="mt-4 flex items-start gap-2 overflow-hidden rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs leading-snug text-[var(--danger)]"
                >
                  <AlertCircle size={14} className="mt-px shrink-0" />
                  {formError}
                </motion.div>
              )}
            </AnimatePresence>

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

      <ConfirmRemoveItemDialog
        open={removeIndex !== null}
        line={removingLine}
        lineNumber={(removeIndex ?? 0) + 1}
        categoryName={
          removingLine?.categoryId
            ? (categoryNames.get(removingLine.categoryId) ?? "")
            : ""
        }
        onCancel={cancelRemoveItem}
        onConfirm={confirmRemoveItem}
      />
    </div>
  );
};

export default AddExpenses;
