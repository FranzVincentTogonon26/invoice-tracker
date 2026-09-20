import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import * as aiController from "../controllers/ai.controller.js";
import { uploadReceipt } from "../middleware/upload.js";

const router = express.Router();

// Protected Routes

router.post(
  "/receipt-parse",
  authMiddleware,
  uploadReceipt,
  aiController.extractReceipt,
);

// JSON-only (no upload): the confirmed scan is analyzed once more so the
// grouped receipt line gets a readable description and the best-fit category.
router.post("/expense-suggest", authMiddleware, aiController.suggestExpenses);

export default router;
