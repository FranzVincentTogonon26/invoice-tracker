import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import { rateLimit, userKey } from "../middleware/rateLimit.js";
import { uploadReceiptBatch } from "../middleware/upload.js";
import * as expensesController from "../controllers/expenses.controller.js";

const router = express.Router();

// File writes per user per hour: receipts are 10MB × 10 files max per call,
// so an unbounded caller fills the disk. Legitimate saves stay far under it.
const receiptUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  key: userKey("receipt-upload"),
  message: "Too many uploads. Please try again later.",
  code: "UPLOAD_RATE_LIMITED",
});

// Protected Routes

router.get("/", authMiddleware, expensesController.expenses);
router.get(
  "/employee",
  authMiddleware,
  requireEmployeeAccess,
  expensesController.expensesEmployee,
);
router.post("/", authMiddleware, expensesController.create);

// Deferred receipt upload: every receipt the Add Expenses form still holds is
// sent here in ONE multipart request when the admin confirms "Save expenses",
// and only then is each file written to `uploads/receipts`. The scan endpoint
// (`POST /ai/receipt-parse`) is parse-only, so a dropped-but-discarded receipt
// never leaves a file behind. Declared before the "/:id" routes so the literal
// "receipt-images" segment can never parse as a validated uuid — express.Router
// matches top-down.
router.post(
  "/receipt-images",
  authMiddleware,
  receiptUploadLimiter,
  uploadReceiptBatch,
  expensesController.uploadReceiptImages,
);

// Declared before "/:id" so the literal "category" segment wins the match.
// Category deletion is open to any active user (admin or employee), same as
// creation — authMiddleware still guarantees the caller exists and is active.
router.delete(
  "/category/:id",
  authMiddleware,
  expensesController.removeCategory,
);

// The View expense modal: this row plus its scanned receipt lines.
// Placed before "/:id" so the literal "detail" segment never parses as the
// validated uuid route below — express.Router matches top-down.
router.get("/detail/:id", authMiddleware, expensesController.detail);

// Employee ledger row action: "Delete expense" is a soft delete — the record
// stays in the ledger and its status moves to 'draft' through this endpoint.
router.patch("/:id/status", authMiddleware, expensesController.updateStatus);

// Admin ledger row action: "Add to draft" — an employee-authored expense that
// is still 'paid' (or voided 'cancel') is pushed back to 'draft' (the row
// stays in the ledger and the amount returns to that employee's available
// balance). Admin-only: the employee + paid-or-cancelled condition is
// enforced inside the model's guarded UPDATE.
router.patch(
  "/:id/employee-draft",
  authMiddleware,
  requireAdminAccess,
  expensesController.markEmployeeDraft,
);

// Admin ledger row action: "Remove from draft" — an employee-authored draft is
// put back to 'paid' (it counts against the employee's balance again).
// Admin-only: the employee + draft condition is enforced inside the model's
// guarded UPDATE.
router.patch(
  "/:id/employee-paid",
  authMiddleware,
  requireAdminAccess,
  expensesController.markEmployeePaid,
);

// Admin approval for a flagged expense: clears `expenses.flag` back to 0
// (the "Approve flag" action inside the flaggedNotice of the View expense
// modal). Admin-only — employees see the flag as a read-only warning tone
// in their own ledger, never the clear action.
router.patch(
  "/:id/clear-flag",
  authMiddleware,
  requireAdminAccess,
  expensesController.clearFlag,
);

// Update expense description (inline editing from transaction sheet)
router.patch("/:id/description", authMiddleware, expensesController.updateDescription);

// Admin review notes (ExpenseDetailsModal, draft rows) — free-form comment
// trail for suspicious lines. Admin-only.
router.patch(
  "/:id/notes",
  authMiddleware,
  requireAdminAccess,
  expensesController.updateNotes,
);

router.delete("/:id", authMiddleware, expensesController.remove);

export default router;
