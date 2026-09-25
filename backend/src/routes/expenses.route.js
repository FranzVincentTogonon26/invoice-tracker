import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import * as expensesController from "../controllers/expenses.controller.js";

const router = express.Router();

// Protected Routes

router.get("/", authMiddleware, expensesController.expenses);
router.get("/employee", authMiddleware, expensesController.expensesEmployee);
router.post("/", authMiddleware, expensesController.create);

// Declared before "/:id" so the literal "category" segment wins the match.
router.delete(
  "/category/:id",
  authMiddleware,
  expensesController.removeCategory,
);

// The View expense modal: this row plus its scanned receipt lines.
// Placed before "/:id" so the literal "detail" segment never parses as the
// validated uuid route below — express.Router matches top-down.
router.get("/detail/:id", authMiddleware, expensesController.detail);

router.delete("/:id", authMiddleware, expensesController.remove);

export default router;
