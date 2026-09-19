import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireAdminAccess from "../middleware/admin.middleware.js";
import * as aiController from "../controllers/ai.controller.js";
import { uploadReceipt } from "../middleware/upload.js";


const router = express.Router();

// Protected Routes

router.post(
  "/receipt-parse",
  authMiddleware,
  requireAdminAccess,
  uploadReceipt,
  aiController.extractReceipt,
);


export default router;
