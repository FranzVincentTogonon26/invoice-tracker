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
// Cancels a budget transaction (budget.status -> 'cancelled'). The response
// includes the previous status so the UI can offer an undo window.
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
