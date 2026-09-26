import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
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
