import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import * as employeeOverviewController from "../controllers/employee.overview.controller.js";

const router = express.Router();

// Protected Routes — active employees only (see employee.middleware.js).
router.get(
  "/",
  authMiddleware,
  requireEmployeeAccess,
  employeeOverviewController.employeeOverview,
);

export default router;
