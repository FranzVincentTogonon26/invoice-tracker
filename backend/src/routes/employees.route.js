import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import { uploadAvatar } from "../middleware/upload.js";
import * as employeesController from "../controllers/employees.controller.js";

const router = express.Router();

// Protected Routes
router.get(
  "/overview",
  authMiddleware,
  requireAdminAccess,
  employeesController.overview,
);
router.get(
  "/",
  authMiddleware,
  requireAdminAccess,
  employeesController.employees,
);

// Resolves a `budget_issued_reference` row id to its holder (bir-id deep
// links into the employee profile). Static segment, so it sits above the
// "/:id" routes.
router.get(
  "/by-issuance/:birId",
  authMiddleware,
  requireAdminAccess,
  employeesController.holderByIssuance,
);

// Admin → Employees → Details tabs — one selected employee's records
// (read-only). Declared before the destructive "/:id" routes; every handler
// re-validates the target account (exists, any status) server-side.
router.get(
  "/:id/overview",
  authMiddleware,
  requireAdminAccess,
  employeesController.detailsOverview,
);
router.get(
  "/:id/budget",
  authMiddleware,
  requireAdminAccess,
  employeesController.detailsBudget,
);
router.get(
  "/:id/expenses",
  authMiddleware,
  requireAdminAccess,
  employeesController.detailsExpenses,
);
router.get(
  "/:id/abono",
  authMiddleware,
  requireAdminAccess,
  employeesController.detailsAbono,
);
router.post(
  "/",
  authMiddleware,
  requireAdminAccess,
  employeesController.create,
);
router.patch(
  "/:id/status",
  authMiddleware,
  requireAdminAccess,
  employeesController.updateStatus,
);
// Admin replaces one employee's profile photo (multipart `avatar` file,
// same photo rules as the employee's own Account tab).
router.patch(
  "/:id/avatar",
  authMiddleware,
  requireAdminAccess,
  uploadAvatar,
  employeesController.updateAvatar,
);
router.delete(
  "/:id",
  authMiddleware,
  requireAdminAccess,
  employeesController.remove,
);

export default router;
