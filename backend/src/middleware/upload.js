import multer from "multer";
import ApiError from "../utils/ApiError.js";
import {
  AVATAR_ALLOWED_EXTENSIONS,
  AVATAR_ALLOWED_MIME_TYPES,
} from "../utils/avatarImage.js";

const MAX_BYTES = 10 * 1024 * 1024;

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      return cb(ApiError.badRequest("Upload a PDF or image (PNG/JPG/WEBP)"));
    }
    cb(null, true);
  },
});

// Save-time batch: Add Expenses uploads every receipt it still holds in ONE
// request, so the cap mirrors the form's own limit (frontend keeps at most
// MAX_DRAFTS = 10 drafts). Files still land in memory only — the controller
// writes each one through `saveReceiptImage` once the save is confirmed.
const uploadMany = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      return cb(ApiError.badRequest("Upload a PDF or image (PNG/JPG/WEBP)"));
    }
    cb(null, true);
  },
});

// Multer wraps its own errors, so a failed upload never reaches the handler
// with `req.file` set — fail fast with a readable ApiError instead.
export const uploadReceipt = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest("File exceeds 10MB limit"));
      }
      return next(ApiError.badRequest(err.message));
    }

    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest("No file Uploaded"));
    next();
  });
};

// Same failure mapping for the multi-file save-time upload. `files` is the
// multipart field name (`form.append("files", file)` per receipt).
export const uploadReceiptBatch = (req, res, next) => {
  uploadMany.array("files", 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest("A receipt file exceeds the 10MB limit"));
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return next(
          ApiError.badRequest("Too many receipts in one save (max 10)"),
        );
      }
      return next(ApiError.badRequest(err.message));
    }

    if (err) return next(err);
    if (!req.files?.length) {
      return next(ApiError.badRequest("No receipt files uploaded"));
    }
    next();
  });
};

// Setting → Account avatar photo (multipart field name: `avatar`).
//
// PHOTOS ONLY, capped at 5MB (memoryStorage holds the whole file in RAM —
// an uncapped photo endpoint is a trivial OOM vector). The file filter
// checks BOTH the mime type and the file-name extension against the shared
// allow-list in utils/avatarImage.js (the same list the storage step
// re-checked when it mints the stored file name), so an executable renamed
// `photo.png` still fails on its mime type.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(AVATAR_ALLOWED_MIME_TYPES);
const AVATAR_EXTENSIONS = new Set(AVATAR_ALLOWED_EXTENSIONS);

const extensionOf = (fileName) => {
  const match = /\.([a-z0-9]+)$/i.exec(String(fileName ?? "").trim());
  return match ? match[1].toLowerCase() : "";
};

const uploadAvatarFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const accepted =
      AVATAR_MIME_TYPES.has(String(file.mimetype).toLowerCase()) &&
      AVATAR_EXTENSIONS.has(extensionOf(file.originalname));

    if (!accepted) {
      return cb(
        ApiError.badRequest(
          "Upload a photo (PNG, JPG, JPEG, WEBP, HEIC or HEIF).",
          "INVALID_AVATAR_FILE",
        ),
      );
    }
    cb(null, true);
  },
});

// A missing file is NOT an error here: the account form may only be changing
// the name/email, and the photo is optional on every save.
export const uploadAvatar = (req, res, next) => {
  uploadAvatarFile.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          ApiError.badRequest(
            "Avatar photo exceeds the 5MB limit.",
            "INVALID_AVATAR_UPLOAD",
          ),
        );
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          ApiError.badRequest("Only one avatar photo can be uploaded at a time."),
        );
      }
      return next(ApiError.badRequest(err.message, "INVALID_AVATAR_UPLOAD"));
    }

    if (err) return next(err);
    next();
  });
};
