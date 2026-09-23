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
import { cn, formatMoney, toISODate } from "../../../../lib/utils";
import { FUNDING_STATUS, fundingState } from "../../../../lib/funding";
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

/* Draft lines the save can't accept yet: an amount of 0 (nothing typed) reads
   as ₱0.00 in the summary, which is exactly what the save error and the red row
   flag point at. */
const zeroAmountIndexesFor = (items) =>
  items
    .map((item, index) => (!(Number(item.totalAmount) > 0) ? index : -1))
    .filter((index) => index >= 0);

/* "Line 2 (Pamasahe)" — how the save errors point at one draft line. */
const lineLabel = (item, index) =>
  `Line ${index + 1}${
    item.description.trim() ? ` (${item.description.trim()})` : ""
  }`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoDateOnly = (value) => {
  const iso = String(value ?? "")
    .trim()
    .slice(0, 10);
  return ISO_DATE_RE.test(iso) ? iso : undefined;
};

const toPayload = (item, { receiptId, imageUrl, receiptDate } = {}) => ({
  description: item.description.trim(),
  category_id: item.categoryId || undefined,
  expense_date: isoDateOnly(item.date),
  total_amount: Number(item.totalAmount) || 0,
  receipt_id: receiptId || undefined,
  image_url: imageUrl || undefined,
  receipt_date: isoDateOnly(receiptDate),
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
        <span className="mt-1.5 block text-xs leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

const AddExpenses = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({ items: [blankItem()] });
  const [referenceId, setReferenceId] = useState("");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [addItemError, setAddItemError] = useState("");
  // Zero-amount flags + the "Line N still reads ₱0.00 …" footer only render
  // after the Save button is clicked — a fresh blank row isn't an error until
  // a save is attempted. The flagged list stays derived from the live draft,
  // so corrected lines revert on the next keystroke.
  const [showZeroAmountErrors, setShowZeroAmountErrors] = useState(false);
  const [removeIndex, setRemoveIndex] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
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

  useEffect(() => {
    if (!addItemError) return undefined;
    const id = setTimeout(() => setAddItemError(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [addItemError]);

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

  const requestRemoveItem = (index, trigger) => {
    const line = items[index];
    if (!line?.description?.trim()) {
      removeItem(index);
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
    addLineRef.current?.focus();
  };

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

  const selectedReferenceId = useMemo(() => {
    if (references.length === 1) return references[0].reference_id;
    return references.some((ref) => ref.reference_id === referenceId)
      ? referenceId
      : "";
  }, [references, referenceId]);

  // Lines still missing an amount — refused by the save ("Cannot proceed …
  // ₱0.00 = 0.00 … add an amount to proceed"). `flaggedLines` below is the
  // same list, gated on a save attempt so it stays empty until the Save
  // button is actually clicked.
  const zeroAmountIndexes = useMemo(() => zeroAmountIndexesFor(items), [items]);
  const flaggedLines = showZeroAmountErrors ? zeroAmountIndexes : [];

  // The source funding this draft and how it stands — the very same shared
  // calculation the SelectSourceFund card renders, so the save's insufficient
  // funds check can never disagree with the balance on screen.
  const funding = useMemo(
    () => fundingState(references, selectedReferenceId, total),
    [references, selectedReferenceId, total],
  );
  // The same state that turns the SelectSourceFund badge "Insufficient": the
  // picked source can't cover the draft, so saving is blocked outright. While
  // it holds, the Save button is disabled and this guard keeps a stale click
  // (or a race with refreshed references) from sending the request anyway.
  // `depleted` still saves — it uses the source up exactly.
  const insufficientFunds = funding.status === FUNDING_STATUS.insufficient;
  // With more than one open source the admin must pick which one funds these
  // lines: saving with nothing selected would file the expenses against no
  // budget at all (the server stores a NULL reference_id). A lone source is
  // auto-mirrored above, so it never needs a pick of its own.
  const sourceUnselected = funding.sources.length > 1 && !funding.source;
  // No source of funds exists at all (or the references haven't loaded yet):
  // there is nothing that could fund the draft, so the Save button is
  // disabled and handleSave refuses the state below as a backstop against a
  // stale click — expenses never save against a missing budget source.
  const noSources = funding.sources.length === 0;

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
    // From here on the summary may flag the offending ₱0.00 rows — the Save
    // button was clicked, so calling them out is no longer premature.
    setShowZeroAmountErrors(true);
    // Source-of-funds gate: expenses may only save against a selected budget
    // source. Both states disable the Save button, so these guards only fire
    // on a stale click or a race with refreshed references — the request can
    // never go out with no funder at all.
    if (funding.sources.length === 0) {
      setFormError(
        "No source of funds detected — add a budget source before saving.",
      );
      return;
    }
    if (!selectedReferenceId) {
      setFormError("Please select source of funds to proceed.");
      return;
    }
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
    // A line whose amount still reads ₱0.00 = 0.00 can't be saved — name the
    // ones at fault so nobody has to hunt for the empty amount field.
    if (zeroAmountIndexes.length > 0) {
      setFormError(
        `Cannot proceed with your request — ${zeroAmountIndexes
          .map(
            (index) =>
              `${lineLabel(items[index], index)} is ${formatMoney(
                items[index].totalAmount,
              )} = 0.00`,
          )
          .join(", ")}. Add an amount to proceed.`,
      );
      return;
    }
    const invalidIndex = firstIncompleteIndex(items);
    if (invalidIndex >= 0) {
      setFormError(
        `Line ${invalidIndex + 1} needs a description and an amount greater than zero.`,
      );
      return;
    }
    // Funding is checked against the drafted total before anything is sent: an
    // insufficient source is a hard stop here, not a surprise after the round
    // trip. `depleted` still goes through — it uses the source up exactly.
    if (insufficientFunds) {
      setFormError(
        `Cannot proceed with your request — insufficient funds in ${
          funding.source?.label || "the selected budget source"
        }. These expenses total ${formatMoney(total)}, but only ${formatMoney(
          funding.balance,
        )} is left (short by ${formatMoney(
          funding.shortfall,
        )}). Lower an amount or pick another budget source.`,
      );
      return;
    }
    try {
      const receipts = [];
      const drafts = new Map();
      for (const item of touched) {
        if (!item.receiptLocal || !item.receiptId) continue;
        if (drafts.has(item.receiptId)) continue;
        const draft = readPendingReceipt(item.receiptId);
        if (!draft) continue;
        drafts.set(item.receiptId, draft);
        receipts.push({
          receipt_id: draft.receiptId,
          vendor: draft.vendor || item.receiptName || "",
          items: (draft.items ?? []).map((line) => ({
            description: line.description ?? "",
            qty: Number(line.qty ?? line.quantity ?? 0) || 0,
            rate: Number(line.rate ?? 0) || 0,
            amount: Number(line.amount ?? 0) || 0,
          })),
        });
      }
      await create.mutateAsync({
        type: "expense",
        reference_id: selectedReferenceId || undefined,
        receipts,
        items: touched.map((item) => {
          const draft = drafts.get(item.receiptId);
          return toPayload(item, {
            receiptId: item.receiptLocal && !draft ? undefined : item.receiptId,
            imageUrl: draft?.imageUrl || item.receiptUrl || undefined,
            receiptDate: draft?.date || (item.dateLocked ? item.date : ""),
          });
        }),
      });
      // Saved cleanly — drop every parked draft so the next Add Expenses form
      // starts fresh (leftover drafts would point at receipts that now exist).
      clearPendingReceipts();
      toast.success(
        `Saved ${touched.length} expense line${touched.length === 1 ? "" : "s"}.`,
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
        <Card padding="lg" className="relative rounded-3xl px-2 sm:px-6">
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
              <Badge tone="neutral" className="tabular-nums">
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
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-display text-xs font-semibold tabular-nums text-[var(--bg)]">
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
                      className="tabular-nums"
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
                        className="pl-8 text-right font-semibold tabular-nums"
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
                      <p className="text-xs text-[var(--ink-muted)]">
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
          <Card padding="lg" className="relative rounded-3xl px-2 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription>
                  Funding, totals and the lines about to be saved.
                </CardDescription>
              </div>
              <Badge tone="accent" className="shrink-0 tabular-nums">
                {items.length} line{items.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
              <p className="type-eyebrow text-[var(--accent-strong)]">
                Total expenses
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {formatMoney(total)}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Across {items.length} line{items.length === 1 ? "" : "s"} ·{" "}
                {filledCount} described
              </p>
            </div>

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
              {items.map((it, i) => {
                // An amount still at 0 (nothing typed) reads ₱0.00 = 0.00 — the
                // exact thing the save refuses. The flag only appears after
                // the Save button is clicked, so a fresh blank line is never
                // scolded on sight.
                const missingAmount = flaggedLines.includes(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      "-mx-2 flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-[var(--surface-2)]/70",
                      missingAmount &&
                        "bg-[var(--danger)]/10 ring-1 ring-inset ring-[var(--danger)]/20",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[var(--ink-muted)]">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold tabular-nums",
                          missingAmount &&
                            "bg-[var(--danger)]/12 text-[var(--danger)]",
                        )}
                      >
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
                    {missingAmount ? (
                      <span
                        className="shrink-0 text-right leading-tight"
                        title="Add an amount greater than zero to proceed"
                      >
                        <span className="block font-semibold tabular-nums text-[var(--danger)]">
                          {formatMoney(it.totalAmount)}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(it.totalAmount)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="my-4 h-px bg-[var(--border)]" />

            <div className="flex items-start gap-2 rounded-xl bg-[var(--accent-soft)]/50 px-3 py-2.5 text-xs leading-snug text-[var(--ink-muted)]">
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
                disabled={saving || insufficientFunds || sourceUnselected || noSources}
                title={
                  noSources
                    ? "No source of funds detected — add a budget source first"
                    : sourceUnselected
                      ? "Select a budget source to fund these expenses"
                      : insufficientFunds
                        ? "Cannot proceed — the selected budget source is insufficient"
                        : undefined
                }
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
