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

// Admin settlement: settle an employee's checked OPEN abono rows and book
// each amount back as an issued_budget row under the same budget reference.
// Admin-only.
router.post(
  "/settle",
  authMiddleware,
  requireAdminAccess,
  employeeReimbursementsController.settleAbono,
);

// Admin submit: finalize an employee's reimbursement by closing every OPEN
// issuance reference they hold. Declared before any "/:id" route so the
// literal "submit" segment never parses as an id. Admin-only.
router.post(
  "/:id/submit",
  authMiddleware,
  requireAdminAccess,
  employeeReimbursementsController.submit,
);

export default router;
