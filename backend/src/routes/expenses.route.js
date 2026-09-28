import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import * as expensesController from "../controllers/expenses.controller.js";

const router = express.Router();

// Protected Routes

router.get("/", authMiddleware, expensesController.expenses);
router.get(
  "/employee",
  authMiddleware,
  requireEmployeeAccess,
  expensesController.expensesEmployee,
);
router.post("/", authMiddleware, expensesController.create);

// Declared before "/:id" so the literal "category" segment wins the match.
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
// is still 'paid' is pushed back to 'draft' (the row stays in the ledger and
// the amount returns to that employee's available balance). Admin-only: the
// employee + paid condition is enforced inside the model's guarded UPDATE.
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

// Update expense description (inline editing from transaction sheet)
router.patch("/:id/description", authMiddleware, expensesController.updateDescription);

router.delete("/:id", authMiddleware, expensesController.remove);

export default router;
