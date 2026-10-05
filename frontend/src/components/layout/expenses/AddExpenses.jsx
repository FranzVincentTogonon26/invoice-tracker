import {
  AlertCircle,
  AlertTriangle,
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
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Card, CardDescription, CardTitle } from "../../ui/Card";
import { DatePicker } from "../../ui/DatePicker";
import { Input, TextArea } from "../../ui/Input";
import Listbox from "../../ui/Listbox";
import {
  cn,
  formatDate,
  formatMoney,
  toDate,
  toISODate,
} from "../../../lib/utils";
import { FUNDING_STATUS, fundingState } from "../../../lib/funding";
import {
  ERROR_VISIBLE_MS,
  MAX_RECEIPT_LABEL,
  USER_ROLES,
} from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import { useExpenses, useExpensesMutations } from "../../../hooks/useExpenses";
import { useExpenseSuggestion } from "../../../hooks/useExpenseSuggestion";
import {
  clearPendingReceipts,
  readPendingReceipt,
  removePendingReceipt,
} from "../../../lib/receiptDraft";
import {
  clearReceiptFiles,
  getReceiptFile,
  removeReceiptFile,
} from "../../../lib/receiptFiles";
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

// True as soon as the amount box holds anything the user typed — "0", "0.00"
// and "-0" included. A typed zero is a filled-in line that must be corrected,
// not a blank row to skip: treating it as untouched would drop it from the
// request without ever showing the zero-amount guard.
const hasAmountInput = (item) => String(item.totalAmount ?? "").trim() !== "";

// `totalAmount` is either "" or numeric text; everything that isn't greater
// than zero (blank, 0, 0.00, negative) counts as a zero amount.
const isZeroAmount = (item) => !(Number(item.totalAmount) > 0);

const isUntouchedItem = (item) =>
  !item.description.trim() &&
  !item.categoryId &&
  !item.receiptId &&
  !hasAmountInput(item);

// A line the user actually typed into (description, amount or a scanned
// receipt). Only these are saved and validated — a row that was just added and
// left empty is skipped instead of blocking the save.
const isTouchedLine = (item) =>
  Boolean(item.description.trim()) ||
  hasAmountInput(item) ||
  Boolean(item.receiptId);

const missingFieldsFor = (item) => {
  const missing = [];
  if (!item.description.trim()) missing.push("description");
  if (isZeroAmount(item)) missing.push("amount");
  return missing;
};

const firstIncompleteIndex = (items) =>
  items.findIndex((item) => missingFieldsFor(item).length > 0);

const zeroAmountIndexesFor = (items) =>
  items
    .map((item, index) => (isZeroAmount(item) ? index : -1))
    .filter((index) => index >= 0);

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

const isBeforeFirstIssued = (date, firstIssuedAt) => {
  const day = isoDateOnly(date);
  const first = isoDateOnly(firstIssuedAt);
  return Boolean(day && first) && day < first;
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

function Field({ label, children, hint, hintTone = "muted" }) {
  return (
    <div className="block min-w-0">
      <span className="mb-1.5 block type-eyebrow text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span
          className={cn(
            "mt-1.5 block text-xs leading-snug",
            hintTone === "danger"
              ? "text-[var(--danger)]"
              : hintTone === "warning"
                ? "text-[var(--warning)]"
                : "text-[var(--ink-muted)]",
          )}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

const AddExpenses = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ items: [blankItem()] });
  const [referenceId, setReferenceId] = useState("");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [addItemError, setAddItemError] = useState("");
  const [showZeroAmountErrors, setShowZeroAmountErrors] = useState(false);
  const [removeIndex, setRemoveIndex] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const pendingRemoveRef = useRef(null);
  const removeTriggerRef = useRef(null);
  const addLineRef = useRef(null);
  // Receipt files are uploaded only on save (deferred batch upload). If the
  // save fails after the upload succeeded, the stored URLs are kept here so a
  // retry reuses them instead of writing the same file to `uploads/receipts`
  // a second time.
  const uploadedReceiptUrlsRef = useRef(new Map());
  const {
    categories,
    references,
    firstIssuedAt,
    isLoading: referencesLoading,
  } = useExpenses();
  const { create, uploadReceiptImages } = useExpensesMutations();

  const isActiveSession = Boolean(user?.user_id && user?.status === "active");
  const isEmployee = user?.role === USER_ROLES.EMPLOYEE;
  const isAdmin = user?.role === USER_ROLES.ADMIN;
  const sourceMode = isEmployee ? "balance" : "budget";

  // Toast visibility boundary — AddExpenses is shared by both roles, so every
  // popup below goes through these helpers: only the submitter's own session
  // (employee submit → employee sees, admin submit → admin sees) ever shows
  // one. No toast fires for inactive sessions or other roles.
  const notifySuccess = (message) => {
    if (!isActiveSession || (!isEmployee && !isAdmin)) return;
    toast.success(message);
  };
  const notifyError = (message) => {
    if (!isActiveSession || (!isEmployee && !isAdmin)) return;
    toast.error(message);
  };

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
  // The button must also read "saving" while the deferred receipt upload runs
  // (it fires just before the create request), so a double submit can't push
  // the same files twice.
  const saving = create.isPending || uploadReceiptImages.isPending;
  const { loading: suggesting, suggest } = useExpenseSuggestion({
    onError: (message) => notifyError(message),
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
    if (removed?.receiptId) {
      removePendingReceipt(removed.receiptId);
      // The held file dies with its line — the save only uploads receipts that
      // are still attached to a row.
      removeReceiptFile(removed.receiptId);
    }
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

  const zeroAmountIndexes = useMemo(() => zeroAmountIndexesFor(items), [items]);
  const flaggedLines = useMemo(
    () => (showZeroAmountErrors ? zeroAmountIndexes : []),
    [showZeroAmountErrors, zeroAmountIndexes],
  );

  const firstIssuedDate = isEmployee ? isoDateOnly(firstIssuedAt) : undefined;
  const firstIssuedLabel = firstIssuedDate
    ? formatDate(toDate(firstIssuedDate))
    : "";
  const backdatedLines = useMemo(
    () =>
      firstIssuedDate
        ? items
            .map((item, index) =>
              isBeforeFirstIssued(item.date, firstIssuedDate) ? index : -1,
            )
            .filter((index) => index >= 0)
        : [],
    [items, firstIssuedDate],
  );

  const funding = useMemo(
    () => fundingState(references, selectedReferenceId, total),
    [references, selectedReferenceId, total],
  );

  const insufficientFunds = funding.status === FUNDING_STATUS.insufficient;
  const sourceUnselected = funding.sources.length > 1 && !funding.source;
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
    setShowZeroAmountErrors(true);

    if (!isActiveSession) {
      const message =
        "Your login must belong to an active user account to save expenses — contact an administrator.";
      setFormError(message);
      notifyError(message);
      return;
    }

    if (funding.sources.length === 0) {
      const message = isEmployee
        ? "No remaining balance found — ask your admin to issue budget or add abono before saving."
        : "No source of funds detected — add a budget source before saving.";
      setFormError(message);
      notifyError(message);
      return;
    }

    if (!selectedReferenceId) {
      const message = "Please select source of funds to proceed.";
      setFormError(message);
      notifyError(message);
      return;
    }

    const touchedIndexes = items.reduce(
      (acc, item, index) => (isTouchedLine(item) ? [...acc, index] : acc),
      [],
    );
    const touched = touchedIndexes.map((index) => items[index]);

    if (touched.length === 0) {
      setShowZeroAmountErrors(false);
      const message = "Add at least one expense line before saving.";
      setFormError(message);
      notifyError(message);
      return;
    }

    if (zeroAmountIndexes.length > 0) {
      const zeroLabels = zeroAmountIndexes.map(
        (index) =>
          `${lineLabel(items[index], index)} has a ${formatMoney(
            items[index].totalAmount,
          )} value`,
      );
      const message = `Cannot proceed with your request — ${zeroLabels.join(
        ", ",
      )}. Every item must be greater than zero, please add a value or remove the line to proceed.`;
      setFormError(message);
      notifyError(message);
      return;
    }

    const invalidIndex = items.findIndex(
      (item, index) =>
        touchedIndexes.includes(index) && missingFieldsFor(item).length > 0,
    );
    if (invalidIndex >= 0) {
      const message = `Line ${invalidIndex + 1} needs a description and an amount greater than zero.`;
      setFormError(message);
      notifyError(message);
      return;
    }

    if (insufficientFunds) {
      const message = isEmployee
        ? `Cannot proceed with your request — insufficient funds. These expenses total ${formatMoney(total)}, but only ${formatMoney(funding.balance)} is left in your remaining balance (short by ${formatMoney(funding.shortfall)}). Lower an amount on any line to fit your balance.`
        : `Cannot proceed with your request — insufficient funds in ${
            funding.source?.label || "the selected budget source"
          }. These expenses total ${formatMoney(total)}, but only ${formatMoney(
            funding.balance,
          )} is left (short by ${formatMoney(
            funding.shortfall,
          )}). Lower an amount or pick another budget source.`;
      setFormError(message);
      notifyError(message);
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

      // Deferred receipt upload — the whole point of holding the files: nothing
      // was sent while receipts were picked, so every file this form still
      // holds goes up in ONE request now that the save is confirmed, and only
      // then does a file land in `uploads/receipts`. `uploadedReceiptUrlsRef`
      // carries the URLs of an earlier failed attempt so a retry never stores
      // the same file twice.
      const heldFiles = [];
      for (const item of touched) {
        if (!item.receiptId) continue;
        if (heldFiles.some((held) => held.receiptId === item.receiptId))
          continue;
        const file = getReceiptFile(item.receiptId);
        if (file) heldFiles.push({ receiptId: item.receiptId, file });
      }

      const toUpload = heldFiles.filter(
        (held) => !uploadedReceiptUrlsRef.current.has(held.receiptId),
      );

      if (toUpload.length > 0) {
        const images = await uploadReceiptImages.mutateAsync(
          toUpload.map((held) => held.file),
        );
        // The response mirrors the multipart order: images[i] belongs to the
        // file at toUpload[i].
        toUpload.forEach((held, i) => {
          const url = images[i]?.image_url;
          if (url) uploadedReceiptUrlsRef.current.set(held.receiptId, url);
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
            imageUrl:
              uploadedReceiptUrlsRef.current.get(item.receiptId) ||
              draft?.imageUrl ||
              item.receiptUrl ||
              undefined,
            receiptDate: draft?.date || (item.dateLocked ? item.date : ""),
          });
        }),
      });

      clearPendingReceipts();
      clearReceiptFiles();
      uploadedReceiptUrlsRef.current.clear();
      const flaggedCount = touchedIndexes.filter((index) =>
        backdatedLines.includes(index),
      ).length;
      // Submitter-role-only: employee saves toast to the employee, admin saves
      // toast to the admin (see notify helpers above + realtime gating).
      notifySuccess(
        `Saved ${touched.length} expense line${touched.length === 1 ? "" : "s"}.${
          flaggedCount > 0
            ? ` ${flaggedCount} dated behind your first issued budget ${
                flaggedCount === 1 ? "was" : "were"
              } flagged.`
            : ""
        }`,
      );
      nav(isEmployee ? "/employee/expenses" : "/admin/expenses");
    } catch (error) {
      const message = error?.message || "Couldn't save expenses.";
      setFormError(message);
      // Submitter-role-only: server failures toast to whoever submitted.
      notifyError(message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
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
              <h2 className="font-display sm:text-2xl text-lg font-semibold tracking-tight text-[var(--ink)]">
                Add Expenses
              </h2>
              <Badge tone="accent">New draft</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-muted)] truncate">
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
          <p className="truncate text-xs text-[var(--ink-muted)]">
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
              <CardDescription className="text-xs">
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
                className={cn(
                  "group relative rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 transition-colors sm:p-5",
                  flaggedLines.includes(i) &&
                    "border-[var(--danger)]/40 bg-[var(--danger)]/5",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-display text-xs font-semibold tabular-nums text-[var(--bg)]",
                        flaggedLines.includes(i) && "bg-[var(--danger)]",
                      )}
                    >
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
                    {backdatedLines.includes(i) && (
                      <Badge
                        tone="warning"
                        className="hidden shrink-0 sm:inline-flex"
                        title={`This line is dated before the first budget issued to you (${firstIssuedLabel}) — it will be saved flagged`}
                      >
                        <AlertTriangle size={11} aria-hidden />
                        Behind budget
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
                      backdatedLines.includes(i)
                        ? `Behind the budget issued to you (${firstIssuedLabel}) — this line will be flagged.`
                        : it.dateLocked
                          ? "From the scanned receipt — locked."
                          : undefined
                    }
                    hintTone={
                      backdatedLines.includes(i) ? "warning" : undefined
                    }
                  >
                    <DatePicker
                      value={it.date}
                      onChange={(next) => setItem(i, { date: next })}
                      placeholder="Select date"
                      className={cn(
                        "tabular-nums",
                        // Employee-only: a date behind the first budget issued
                        // to this user reads amber so it is identifiable at a
                        // glance. The save is not blocked — the backend stores
                        // these lines with flag = 1.
                        backdatedLines.includes(i) &&
                          "border-[var(--warning)]/60 ring-2 ring-[var(--warning)]/20 focus:border-[var(--warning)]/60 focus:ring-[var(--warning)]/25",
                      )}
                      disabled={it.dateLocked}
                      title={
                        backdatedLines.includes(i)
                          ? `This date is behind the first budget issued to you (${firstIssuedLabel}) — saving will mark it as flagged`
                          : undefined
                      }
                    />
                  </Field>

                  <Field
                    label="Amount"
                    hint={
                      // The same flag that paints this card's danger border —
                      // a blank / 0 / 0.00 amount blocks the save.
                      flaggedLines.includes(i)
                        ? `This item has a ${formatMoney(
                            it.totalAmount,
                          )} value — add an amount greater than zero to proceed.`
                        : it.amountLocked
                          ? "The receipt's grand total — locked."
                          : undefined
                    }
                    hintTone={flaggedLines.includes(i) ? "danger" : undefined}
                  >
                    <div className="relative">
                      <span
                        className={cn(
                          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold",
                          flaggedLines.includes(i)
                            ? "text-[var(--danger)]"
                            : "text-[var(--ink-muted)]",
                        )}
                      >
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
                        aria-invalid={
                          flaggedLines.includes(i) ? true : undefined
                        }
                        className={cn(
                          "pl-8 text-right font-semibold tabular-nums",
                          flaggedLines.includes(i) &&
                            "border-[var(--danger)]/50 focus:border-[var(--danger)]/60 focus:ring-[var(--danger)]/20",
                        )}
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
                          : `PNG, JPG or WEBP · up to ${MAX_RECEIPT_LABEL}`}
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
                mode={sourceMode}
              />
            </div>

            <div className="mt-4 space-y-1">
              {items.map((it, i) => {
                const missingAmount = flaggedLines.includes(i);
                const backdated = backdatedLines.includes(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-[var(--surface-2)]/70",
                      // A zero amount blocks the save (red) and wins the ring;
                      // an employee line dated behind the first budget issued to
                      // them reads amber instead — it still saves, marked with
                      // flag = 1.
                      missingAmount
                        ? "bg-[var(--danger)]/10 ring-1 ring-inset ring-[var(--danger)]/30"
                        : backdated &&
                            "bg-[var(--warning)]/10 ring-1 ring-inset ring-[var(--warning)]/30",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[var(--ink-muted)]">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold tabular-nums",
                          missingAmount
                            ? "bg-[var(--danger)]/12 text-[var(--danger)]"
                            : backdated &&
                                "bg-[var(--warning)]/14 text-[var(--warning)]",
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
                      {backdated && (
                        <span
                          className="shrink-0 text-[var(--warning)]"
                          title={`Line ${i + 1} is dated behind the first budget issued to you (${firstIssuedLabel}) — it will be saved flagged`}
                        >
                          <AlertTriangle size={13} aria-hidden />
                        </span>
                      )}
                    </span>
                    {missingAmount ? (
                      <span
                        className="shrink-0 text-right leading-tight"
                        title={`Line ${i + 1} has a ${formatMoney(
                          it.totalAmount,
                        )} value — add an amount greater than zero to proceed`}
                      >
                        <span className="flex items-center justify-end gap-1 font-semibold tabular-nums text-[var(--danger)]">
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
                disabled={
                  saving ||
                  !isActiveSession ||
                  insufficientFunds ||
                  sourceUnselected ||
                  noSources
                }
                title={
                  !isActiveSession
                    ? "An active user account is required to save expenses"
                    : noSources
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
                  // Discarding the form drops the held files too — nothing was
                  // uploaded, so there is nothing to clean up server-side.
                  clearReceiptFiles();
                  uploadedReceiptUrlsRef.current.clear();
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
        isBackdatedDate={
          isEmployee && firstIssuedDate
            ? (date) => isBeforeFirstIssued(date, firstIssuedDate)
            : undefined
        }
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
