import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit, userKey } from "../middleware/rateLimit.js";
import * as aiController from "../controllers/ai.controller.js";
import { uploadReceipt } from "../middleware/upload.js";

const router = express.Router();

// Gemini calls cost quota per request — per-user caps so one active token
// (legit or stolen) can't burn it (employees legitimately scan, so this
// stays open to both roles with a budget instead of going admin-only).
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  key: userKey("ai"),
  message: "AI usage limit reached. Please try again later.",
  code: "AI_RATE_LIMITED",
});

router.post(
  "/receipt-parse",
  authMiddleware,
  aiLimiter,
  uploadReceipt,
  aiController.extractReceipt,
);

// JSON-only (no upload): the confirmed scan is analyzed once more so the
// grouped receipt line gets a readable description and the best-fit category.
router.post(
  "/expense-suggest",
  authMiddleware,
  aiLimiter,
  aiController.suggestExpenses,
);

export default router;
