// Temporary receipt store for the "Confirm Receipt" flow.
//
// Confirming a scan does not write to the server: the drafted receipt (random
// id, vendor, date, scan list items and total) is parked in localStorage, and
// `AddExpenses` immediately maps those items into the transaction lines. The
// real `receipt` row is only created when the form is saved, which keeps
// `expenses.receipt_id` free of ids that don't exist yet.
//
// The IMAGE is deferred too: the scan is parse-only, so a confirmed draft
// carries no URL — the picked File lives in memory (`lib/receiptFiles.js`,
// keyed by `receiptId`) until "Save expenses" uploads every held file in one
// request and hands each line its `/api/uploads/receipts/<file>` URL. The
// `imageUrl` field below therefore only survives on LEGACY drafts from the
// older server-stored-scan flow (their files are already on the server);
// `savePendingReceipt` still prunes those links first when the quota is full,
// and only a draft without any link is ever written as a last resort.

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
 * `total` is the LIVE line sum the "Confirm Receipt" footer computed
 * (`confirmedTotal`) — the figure the user actually saw and confirmed. The
 * scan's own grand total is NOT preferred here: lines can be edited, added or
 * removed after a scan (and the grand total may include tax the lines don't
 * itemize), so storing the scan value would park a stale total that no longer
 * matches the confirmed lines.
 */
export const buildReceiptDraft = (receipt, confirmedTotal) => {
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

  const derivedTotal = Number(
    items.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
  );
  const passedTotal = Number(confirmedTotal);

  // The footer sum wins — fall back to the lines' own sum only when the
  // caller didn't hand the live figure over.
  const total =
    confirmedTotal !== undefined &&
    Number.isFinite(passedTotal) &&
    passedTotal > 0
      ? Number(passedTotal.toFixed(2))
      : derivedTotal;

  return {
    receiptId: createReceiptId(),
    vendor: String(receipt?.vendor ?? "").trim(),
    date: String(receipt?.receiptDate ?? "").trim(),
    currency: String(receipt?.currency ?? "").trim(),
    suggestedCategory: String(receipt?.suggestedCategory ?? "").trim(),
    items,
    itemsTotal: total,
    total,
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
 * `{ draft, persisted, imageDropped }`.
 *
 * New drafts carry no image link (the file waits in memory for the save), so
 * the full write virtually always fits. A legacy draft — one parked by the
 * older flow with a stored server URL — is still handled: when the quota is
 * exhausted it is spent on *older* drafts' links first (their files stay on
 * the server), and only a last-resort retry drops the new draft's own link,
 * reporting `imageDropped`.
 */
export const savePendingReceipt = (draft) => {
  if (!draft?.receiptId) return { draft, persisted: false, imageDropped: false };

  const others = readAll().filter((d) => d.receiptId !== draft.receiptId);

  if (writeAll([draft, ...others].slice(0, MAX_DRAFTS))) {
    return { draft, persisted: true, imageDropped: false };
  }

  // Quota full — shave the image links off the older drafts first (their files
  // are still on the server; only the preview link is lost — and a line kept in
  // this session still holds the URL in form state, which the save uses).
  const pruned = others.map((d) => ({ ...d, imageUrl: "" }));
  if (writeAll([draft, ...pruned].slice(0, MAX_DRAFTS))) {
    return { draft, persisted: true, imageDropped: false };
  }

  // Still no room: keep the scanned lines, lose only this draft's image link.
  const light = { ...draft, imageUrl: "" };
  return {
    draft: light,
    persisted: writeAll([light, ...pruned].slice(0, MAX_DRAFTS)),
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
