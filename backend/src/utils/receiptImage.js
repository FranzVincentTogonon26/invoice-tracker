// Receipt images handed in with an expense are persisted here instead of
// inside the browser.
//
// The "Confirm Receipt" flow parks the scanned draft (lines, totals, vendor)
// in localStorage until the Add Expenses form is saved — the image itself is
// held in memory and only reaches the server once "Save expenses" uploads the
// batch (`POST /expenses/receipt-images`), so a dropped-but-discarded receipt
// never leaves a file behind. A multi-megabyte photo converted to a base64
// data URL would blow the ~5MB localStorage quota, so the draft only ever
// carries this file's public URL.
//
// Files live in `<backend>/uploads/receipts` and `app.js` serves them read-only
// at `/api/uploads/...` — the same `/api` origin the frontend already proxies
// for every other call.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ApiError from "./ApiError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `<backend>/uploads` — exported so app.js can mount it with express.static.
export const UPLOADS_ROOT = path.resolve(__dirname, "../../uploads");

const RECEIPT_UPLOADS_DIR = path.join(UPLOADS_ROOT, "receipts");
const RECEIPT_URL_PREFIX = "/api/uploads/receipts";

// The extension comes from the (already validated) mime type so a crafted file
// name can never escape `receipts/`; middleware/upload.js limits mimes to this
// set before the controller ever runs.
const EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

const SAFE_EXTENSION = /^[a-z0-9]{1,8}$/i;

const extensionFor = (mimeType, originalName) => {
  const byMime = EXTENSION_BY_MIME[String(mimeType).toLowerCase()];
  if (byMime) return byMime;

  const fromName = path
    .extname(String(originalName ?? ""))
    .replace(/^\./, "")
    .toLowerCase();
  return SAFE_EXTENSION.test(fromName) ? fromName : "bin";
};

/**
 * Writes one held receipt file to disk and returns the public URL that
 * `expenses.image_url` should store (`/api/uploads/receipts/<uuid>.<ext>`).
 *
 * Throws a 500 ApiError when the file cannot be stored — the calling request
 * fails instead of continuing without the attachment the admin asked to keep
 * (the batch controller rolls back every file it already wrote).
 */
export const saveReceiptImage = async ({ buffer, mimeType, originalName }) => {
  const fileName = `${randomUUID()}.${extensionFor(mimeType, originalName)}`;

  try {
    await fs.mkdir(RECEIPT_UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(RECEIPT_UPLOADS_DIR, fileName), buffer);
  } catch {
    throw ApiError.internal(
      "Couldn't store the receipt image on the server. Please try again.",
      "RECEIPT_IMAGE_WRITE_FAILED",
    );
  }

  return `${RECEIPT_URL_PREFIX}/${fileName}`;
};

/**
 * Removes a file saved by `saveReceiptImage` (used when a save-time batch
 * upload fails halfway, and when the last expense row pointing at it is
 * deleted). Only URLs minted here are accepted, so a stray value can never make
 * the API delete something else out of the uploads folder.
 */
export const deleteReceiptImage = async (publicUrl) => {
  const url = String(publicUrl ?? "");
  if (!url.startsWith(`${RECEIPT_URL_PREFIX}/`)) return false;

  const fileName = path.basename(url);
  const extension = path.extname(fileName).replace(/^\./, "");
  if (!SAFE_EXTENSION.test(extension)) return false;

  try {
    await fs.unlink(path.join(RECEIPT_UPLOADS_DIR, fileName));
    return true;
  } catch {
    return false;
  }
};
