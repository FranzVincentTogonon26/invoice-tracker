import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as transactionsController from "../controllers/transactions.controller.js";

const router = express.Router();

// Protected Routes — admin-only: the unified ledger exposes every account's
// movements, so it must never be reachable with an employee token.
router.get("/", authMiddleware, requireAdminAccess, transactionsController.transactions);

export default router;
