import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import { uploadAvatar } from "../middleware/upload.js";
import * as employeeSettingsController from "../controllers/employee.settings.controller.js";

const router = express.Router();

// Employee Setting — the signed-in employee's own `users` row.
// `requireEmployeeAccess` keeps these employee-only, matching the /employee
// frontend guard (authMiddleware already proved the token maps to a real,
// active users row; every handler re-checks existence + active status again
// right before it writes).

// The Account tab's fresh data (name, email, avatar_url, role, status).
router.get(
  "/account",
  authMiddleware,
  requireEmployeeAccess,
  employeeSettingsController.account,
);

// Saves the Account tab. The optional avatar photo is uploaded in this SAME
// multipart request — the file only reaches `uploads/avatars` when the save is
// applied (nothing is stored while the photo is merely picked or previewed).
router.put(
  "/account",
  authMiddleware,
  requireEmployeeAccess,
  uploadAvatar,
  employeeSettingsController.updateAccount,
);

// Changes the account password (bcrypt-verified, bcrypt-hashed server-side).
// The client signs out afterwards so the next login starts a fresh session.
router.put(
  "/password",
  authMiddleware,
  requireEmployeeAccess,
  employeeSettingsController.updatePassword,
);

export default router;
