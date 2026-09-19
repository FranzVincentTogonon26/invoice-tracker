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
