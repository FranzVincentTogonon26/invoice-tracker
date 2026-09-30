import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import requireEmployeeAccess from "../middleware/employee.middleware.js";
import * as abonoController from "../controllers/abono.controller.js";

const router = express.Router();

// Protected Routes

router.get("/", authMiddleware, abonoController.abono);
router.get(
  "/employee",
  authMiddleware,
  requireEmployeeAccess,
  abonoController.abonoEmployee,
);

// Settle Abono (employee page): flips the checked OPEN rows to 'settled' and
// stamps `date_settled`, in one transaction. Scoped to the token's user id
// server-side; declared before the "/:id" routes so "settle" is never parsed
// as an abono id.
router.patch(
  "/settle",
  authMiddleware,
  requireEmployeeAccess,
  abonoController.settleAbono,
);

router.post("/", authMiddleware, abonoController.create);

// Inline description editing (double-click) from the transaction sheet /
// details portal. Declared after the literal "/employee" segment above so
// express never parses "employee" as an id.
router.patch(
  "/:id/description",
  authMiddleware,
  abonoController.updateDescription,
);

// Row action: "Delete abono" removes the record outright. An employee may
// only delete their own row — ownership is checked in the controller.
router.delete("/:id", authMiddleware, abonoController.removeAbono);

export default router;
