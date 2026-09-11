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
  budgetController.employeesWithBudget,
);
router.post(
  "/",
  authMiddleware,
  requireAdminAccess,
  budgetController.createBudget,
);

export default router;
