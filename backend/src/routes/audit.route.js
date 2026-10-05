import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as auditController from "../controllers/audit.controller.js";

const router = express.Router();

// Audit trail sourced from `backend/logs/transactions.md` (newest first,
// filterable for back-tracing). Admin-only: the file carries every actor's
// amounts, so it must never be served to non-admin tokens.
router.get("/", authMiddleware, requireAdminAccess, auditController.list);

export default router;
