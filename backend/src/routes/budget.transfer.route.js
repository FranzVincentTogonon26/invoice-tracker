import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import * as budgetTransferController from "../controllers/budget.transfer.controller.js";

const router = express.Router();

// Budget Transfer — shared by admins and active employees. Only authMiddleware
// is stacked (valid token, real user, status = active): the controller
// re-verifies the account and restricts the role to admin | employee, so both
// sides reach the same endpoints as long as every user is validated and
// active. Declared before "/:id"-style routes so "overview" is never parsed
// as a param.
router.get(
  "/overview",
  authMiddleware,
  budgetTransferController.transferOverview,
);

router.post("/", authMiddleware, budgetTransferController.create);

// Row action: "Cancel budget transfer" removes the record outright. Only the
// sender (or an admin) may cancel it — ownership is checked in the
// controller, and the cancel is refused when the recipient already spent it.
router.delete("/:id", authMiddleware, budgetTransferController.remove);

export default router;
