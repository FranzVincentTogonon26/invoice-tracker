import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as expensesController from "../controllers/expenses.controller.js";

const router = express.Router();

// Protected Routes

router.get(
  "/",
  authMiddleware,
  requireAdminAccess,
  expensesController.expenses,
);
router.post("/", authMiddleware, requireAdminAccess, expensesController.create);

// Declared before "/:id" so the literal "category" segment wins the match.
router.delete(
  "/category/:id",
  authMiddleware,
  requireAdminAccess,
  expensesController.removeCategory,
);

router.delete(
  "/:id",
  authMiddleware,
  requireAdminAccess,
  expensesController.remove,
);

export default router;
