import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as budgetController from "../controllers/budget.controller.js";

const router = express.Router();

// Alias for the Source of Funds management list — served by the same
// implementation as GET /budgets/references (every reference with live
// aggregates, newest first). Admin-only.
router.get("/", authMiddleware, requireAdminAccess, budgetController.sourceFunds);

export default router;
