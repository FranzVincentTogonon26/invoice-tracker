// Runtime store for receipt files that were picked but not uploaded yet.
//
// Receipt images are only written to the server when the Add Expenses form is
// actually saved — "Save expenses" uploads every held file at once through
// `POST /expenses/receipt-images`. Until that confirmation the picked File
// parks HERE, in memory, keyed by the draft's `receiptId`: localStorage can't
// hold the bytes (the quota problem that pushed scans server-side in the first
// place) and the draft itself only keeps text. A page reload drops the files —
// the draft stays, the save simply proceeds without an image, which mirrors
// the pre-existing "draft without its image" degradation instead of failing.

const files = new Map();

/** Parks one picked File under its draft receipt id (replaces any previous). */
export const registerReceiptFile = (receiptId, file) => {
  if (!receiptId || !file) return false;
  files.set(String(receiptId), file);
  return true;
};

/** The File still waiting to be uploaded for this draft, or null. */
export const getReceiptFile = (receiptId) =>
  files.get(String(receiptId ?? "")) ?? null;

/** Drops one held file (its line was removed or the receipt was discarded). */
export const removeReceiptFile = (receiptId) => {
  files.delete(String(receiptId ?? ""));
};

/** Drops every held file (after a successful save, or on Discard). */
export const clearReceiptFiles = () => {
  files.clear();
};
