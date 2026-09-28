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
