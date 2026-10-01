// Employee avatar photos picked in Setting → Account are persisted here.
//
// Like receipts (utils/receiptImage.js) the picked file is held in memory by
// multer and only written to disk when the form is actually SAVED — the
// controller calls `saveAvatarImage` once the update request has been
// validated, so a photo that was picked and then discarded never leaves a
// file behind. Files live in `<backend>/uploads/avatars` and `app.js` already
// serves the whole uploads root read-only at `/api/uploads/...`, the same
// `/api` origin the frontend proxies (`users.avatar_url` then stores
// `/api/uploads/avatars/<uuid>.<ext>`).
//
// PHOTOS ONLY — no PDFs, and unlike receipts there is NO byte cap (any photo
// size is accepted). Because there is no size limit the extension/mime
// allow-list below is what keeps a crafted file name inside `avatars/`; the
// same list is enforced a second time by middleware/upload.js before the
// controller ever runs.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ApiError from "./ApiError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AVATAR_UPLOADS_DIR = path.resolve(__dirname, "../../uploads/avatars");
const AVATAR_URL_PREFIX = "/api/uploads/avatars";

// Photo extensions an uploaded avatar may carry (mirrored by AVATAR_ACCEPT /
// AVATAR_EXTENSIONS in the frontend picker).
export const AVATAR_ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
];

export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
];

const EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
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
 * Writes one held avatar photo to disk and returns the public URL that
 * `users.avatar_url` should store (`/api/uploads/avatars/<uuid>.<ext>`).
 *
 * Throws a 500 ApiError when the file cannot be stored — the calling request
 * fails instead of saving the account with a broken avatar reference (the
 * controller also deletes an already-written file when the row update fails).
 */
export const saveAvatarImage = async ({ buffer, mimeType, originalName }) => {
  const fileName = `${randomUUID()}.${extensionFor(mimeType, originalName)}`;

  try {
    await fs.mkdir(AVATAR_UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(AVATAR_UPLOADS_DIR, fileName), buffer);
  } catch {
    throw ApiError.internal(
      "Couldn't store your photo on the server. Please try again.",
      "AVATAR_IMAGE_WRITE_FAILED",
    );
  }

  return `${AVATAR_URL_PREFIX}/${fileName}`;
};

/**
 * Removes a file saved by `saveAvatarImage` — used when the account update
 * fails after the photo was written, and when an avatar is replaced/removed
 * (the previous file must not linger). Only URLs minted here are accepted, so
 * a stray value can never make the API delete something else out of the
 * uploads folder. Missing files are treated as already gone (returns true).
 */
export const deleteAvatarImage = async (publicUrl) => {
  const url = String(publicUrl ?? "");
  if (!url.startsWith(`${AVATAR_URL_PREFIX}/`)) return false;

  const fileName = path.basename(url);
  const extension = path.extname(fileName).replace(/^\./, "");
  if (!SAFE_EXTENSION.test(extension)) return false;

  try {
    await fs.unlink(path.join(AVATAR_UPLOADS_DIR, fileName));
    return true;
  } catch {
    return false;
  }
};
