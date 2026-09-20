// Temporary receipt store for the "Confirm Receipt" flow.
//
// Confirming a scan does not write to the server: the drafted receipt (random
// id, vendor, date, scan list items and total) is parked in localStorage, and
// `AddExpenses` immediately maps those items into the transaction lines. The
// real `receipt` row is only created when the form is saved, which keeps
// `expenses.receipt_id` free of ids that don't exist yet.
//
// The image travels as a data URL (up to ~2MB → ~2.7MB base64), which can blow
// the ~5MB localStorage quota, so `savePendingReceipt` retries without it and
// reports whether anything was persisted at all — the in-memory flow still
// works when it wasn't.

const STORAGE_KEY = "invoice-tracker.pending-receipts";
const MAX_DRAFTS = 10;

const hasStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    // Safari (private mode) throws on localStorage access.
    return false;
  }
};

const readAll = () => {
  if (!hasStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((d) => d?.receiptId) : [];
  } catch {
    return [];
  }
};

const writeAll = (drafts) => {
  if (!hasStorage()) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
};

/**
 * Random UUID for a draft. Backend ids are UUIDs too, so a draft id is always
 * shaped like the `receipt_id` it will eventually be replaced by.
 */
export const createReceiptId = () => {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * ExpensesModal scan state → stored draft.
 * `items` keeps the receipt's own quantity/rate plus the derived amount, and
 * `total` prefers the scanned grand total (it may include tax) over the sum of
 * the lines.
 */
export const buildReceiptDraft = (receipt) => {
  const items = (receipt?.items ?? []).map((item) => {
    const quantity = Number(item?.quantity) || 0;
    const rate = Number(item?.rate) || 0;

    return {
      description: String(item?.description ?? "").trim(),
      quantity,
      rate,
      amount: Number((quantity * rate).toFixed(2)),
    };
  });

  const itemsTotal = Number(
    items.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
  );
  const scannedTotal = Number(receipt?.total) || 0;

  return {
    receiptId: createReceiptId(),
    vendor: String(receipt?.vendor ?? "").trim(),
    date: String(receipt?.receiptDate ?? "").trim(),
    currency: String(receipt?.currency ?? "").trim(),
    suggestedCategory: String(receipt?.suggestedCategory ?? "").trim(),
    items,
    itemsTotal,
    total: scannedTotal > 0 ? scannedTotal : itemsTotal,
    imageUrl: receipt?.imageUrl ?? "",
    fileName: receipt?.fileName ?? "",
    createdAt: new Date().toISOString(),
  };
};

/** Every stored draft, newest first. */
export const listPendingReceipts = () => readAll();

/** One draft by id, or null when it was never stored / already cleared. */
export const readPendingReceipt = (receiptId) =>
  readAll().find((draft) => draft.receiptId === receiptId) ?? null;

/**
 * Persists a draft (newest first, capped) and returns
 * `{ draft, persisted, imageDropped }`. The returned `draft` is the one the
 * caller should keep using: when the image alone overflows the quota it comes
 * back without one.
 */
export const savePendingReceipt = (draft) => {
  if (!draft?.receiptId) return { draft, persisted: false, imageDropped: false };

  const others = readAll().filter((d) => d.receiptId !== draft.receiptId);

  if (writeAll([draft, ...others].slice(0, MAX_DRAFTS))) {
    return { draft, persisted: true, imageDropped: false };
  }

  // The image data URL is the size hog — keep the lines, lose the attachment.
  const light = { ...draft, imageUrl: "" };
  return {
    draft: light,
    persisted: writeAll([light, ...others].slice(0, MAX_DRAFTS)),
    imageDropped: true,
  };
};

/** Drops one draft (called once its `receipt` row exists server-side). */
export const removePendingReceipt = (receiptId) => {
  writeAll(readAll().filter((draft) => draft.receiptId !== receiptId));
};

/** Drops every draft (leaving/discarding the Add Expenses form). */
export const clearPendingReceipts = () => {
  if (!hasStorage()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from — the drafts simply stay behind.
  }
};
