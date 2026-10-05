import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import { uploadReceipt } from "../middleware/upload.js";
import * as budgetController from "../controllers/budget.controller.js";

const router = express.Router();

// Employee budget page — the signed-in employee's own issuances + balance
// overview. Stacks authMiddleware (valid token, real user, status=active) and
// requireEmployeeAccess (role=employee AND status=active), so a suspended or
// non-employee token is rejected before the handler runs. Scoped to
// `req.user.id` inside the model — no client-supplied user id.
router.get(
  "/employee",
  authMiddleware,
  requireEmployeeAccess,
  budgetController.budgetEmployee,
);

// Protected Routes
router.get(
  "/",
  authMiddleware,
  requireAdminAccess,
  budgetController.budgetInfo,
);
router.get(
  "/transaction",
  authMiddleware,
  requireAdminAccess,
  budgetController.budgetTransaction,
);
router.get(
  "/issued_transaction",
  authMiddleware,
  requireAdminAccess,
  budgetController.budgetIssuedTransaction,
);
// Cancel an issued budget transaction (budget_issued_reference.status ->
// 'cancel').
router.patch(
  "/issued_transaction/:id/cancel",
  authMiddleware,
  requireAdminAccess,
  budgetController.cancelIssuedTransaction,
);
// Undo an issued cancellation — restores the reference's previous status.
router.patch(
  "/issued_transaction/:id/restore",
  authMiddleware,
  requireAdminAccess,
  budgetController.restoreIssuedTransaction,
);
// Permanently deletes a cancelled issued budget transaction (hard delete of
// the row, parent pruned when childless). Admin-only at the route layer via
// `requireAdminAccess` (auth + role re-checked from the token, so a forged
// client or non-admin caller is rejected before the handler runs); the model
// additionally refuses live rows and rows with linked expenses (409).
router.delete(
  "/issued_transaction/:id",
  authMiddleware,
  requireAdminAccess,
  budgetController.removeIssuedTransaction,
);
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireAdminAccess,
  budgetController.cancelBudget,
);
// Permanently deletes a cancelled budget transaction (hard delete of the
// row). Admin-only at the route layer via `requireAdminAccess` (auth + role
// re-checked from the token); the model additionally refuses live rows
// (two-segment path, so it never collides with `/:referenceId` below).
router.delete(
  "/transaction/:id",
  authMiddleware,
  requireAdminAccess,
  budgetController.removeTransaction,
);
// Undo a cancellation — restores the transaction's previous status.
router.patch(
  "/:id/restore",
  authMiddleware,
  requireAdminAccess,
  budgetController.restoreBudget,
);
router.post("/", authMiddleware, requireAdminAccess, budgetController.create);
// Deferred receipt upload for the Issue Budget scan flow: the single held
// file (`file`) is stored in `uploads/receipts_issued_budget` only when the
// issuance is confirmed — the returned `image_url` lands on the
// `issued_budget` row via the create call that follows.
router.post(
  "/issued-receipt-image",
  authMiddleware,
  requireAdminAccess,
  uploadReceipt,
  budgetController.uploadIssuedReceiptImage,
);
router.get(
  "/balance/:referenceId",
  authMiddleware,
  requireAdminAccess,
  budgetController.referenceBalance,
);
// Pre-submit restriction guard for issuing budgets — reports whether an
// employee still holds an open issuance from a different budget reference.
router.get(
  "/issued_guard/:employeeId",
  authMiddleware,
  requireAdminAccess,
  budgetController.employeeIssuedGuard,
);
router.delete(
  "/:referenceId",
  authMiddleware,
  requireAdminAccess,
  budgetController.deleteReference,
);

export default router;
