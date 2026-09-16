import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
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
router.delete(
  "/:id",
  authMiddleware,
  requireAdminAccess,
  employeesController.remove,
);

export default router;
