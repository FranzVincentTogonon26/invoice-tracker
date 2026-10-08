import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as employeeReimbursementsController from "../controllers/employee-reimbursements.controller.js";

const router = express.Router();

// Protected Routes

router.get("/", authMiddleware, employeeReimbursementsController.list);
router.get(
  "/overview",
  authMiddleware,
  requireAdminAccess,
  employeeReimbursementsController.overview,
);

export default router;
