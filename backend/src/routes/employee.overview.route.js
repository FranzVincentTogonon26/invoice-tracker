import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import * as employeeOverviewController from "../controllers/employee.overview.controller.js";

const router = express.Router();

// Protected Routes
router.get("/", authMiddleware, employeeOverviewController.employeeOverview);

export default router;
