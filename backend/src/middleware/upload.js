import multer from "multer";
import ApiError from "../utils/ApiError.js";

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
