// Scanned receipt images attached to an ISSUED budget (Issue Budget flow).
//
// The browser holds the picked file while the admin reviews the form; it is
// uploaded ONCE when the issuance is confirmed, so nothing lands in
// `uploads/receipts_issued_budget` before that and a dropped-but-discarded
// scan never leaves a file behind.
//
// Files live in `<backend>/uploads/receipts_issued_budget` and `app.js`
// serves the whole `<backend>/uploads` tree read-only at `/api/uploads/...`
// (same origin the frontend already proxies) — no app.js change needed.
// File names are unguessable UUIDs and nothing is ever written here from a URL.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ApiError from "./ApiError.js";
import { UPLOADS_ROOT } from "./receiptImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ISSUED_UPLOADS_DIR = path.join(UPLOADS_ROOT, "receipts_issued_budget");
const ISSUED_URL_PREFIX = "/api/uploads/receipts_issued_budget";

// The extension comes from the (already validated) mime type so a crafted file
// name can never escape `receipts_issued_budget/`; middleware/upload.js limits
// mimes before the controller ever runs.
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
 * Writes one held issued-budget receipt file to disk and returns the public
 * URL that `issued_budget.image_url` should store
 * (`/api/uploads/receipts_issued_budget/<uuid>.<ext>`).
 *
 * Throws a 500 ApiError when the file cannot be stored — the calling request
 * fails instead of continuing without the attachment the admin asked to keep.
 */
export const saveIssuedBudgetImage = async ({
  buffer,
  mimeType,
  originalName,
}) => {
  const fileName = `${randomUUID()}.${extensionFor(mimeType, originalName)}`;

  try {
    await fs.mkdir(ISSUED_UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(ISSUED_UPLOADS_DIR, fileName), buffer);
  } catch {
    throw ApiError.internal(
      "Couldn't store the scanned receipt image on the server. Please try again.",
      "ISSUED_IMAGE_WRITE_FAILED",
    );
  }

  return `${ISSUED_URL_PREFIX}/${fileName}`;
};

/**
 * Removes a file saved by `saveIssuedBudgetImage` (used when the issuance
 * save fails after the upload). Only URLs minted here are accepted, so a
 * stray value can never make the API delete something else out of the
 * uploads folder.
 */
export const deleteIssuedBudgetImage = async (publicUrl) => {
  const url = String(publicUrl ?? "");
  if (!url.startsWith(`${ISSUED_URL_PREFIX}/`)) return false;

  const fileName = path.basename(url);
  const extension = path.extname(fileName).replace(/^\./, "");
  if (!SAFE_EXTENSION.test(extension)) return false;

  try {
    await fs.unlink(path.join(ISSUED_UPLOADS_DIR, fileName));
    return true;
  } catch {
    return false;
  }
};
