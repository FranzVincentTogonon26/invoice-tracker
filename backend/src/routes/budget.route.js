import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as budgetController from "../controllers/budget.controller.js";

const router = express.Router();

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
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireAdminAccess,
  budgetController.cancelBudget,
);
// Undo a cancellation — restores the transaction's previous status.
router.patch(
  "/:id/restore",
  authMiddleware,
  requireAdminAccess,
  budgetController.restoreBudget,
);
router.post("/", authMiddleware, requireAdminAccess, budgetController.create);
router.get(
  "/balance/:referenceId",
  authMiddleware,
  requireAdminAccess,
  budgetController.referenceBalance,
);
router.delete(
  "/:referenceId",
  authMiddleware,
  requireAdminAccess,
  budgetController.deleteReference,
);

export default router;
