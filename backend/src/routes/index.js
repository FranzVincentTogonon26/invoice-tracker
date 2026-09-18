import express from "express";
import authRoutes from "./auth.route.js";
import budgetRoutes from "./budget.route.js";
import employeesRoutes from "./employees.route.js";
import expensesRoutes from "./expenses.route.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "Healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use("/auth", authRoutes);
router.use("/budgets", budgetRoutes);
router.use("/employees", employeesRoutes);
router.use("/expenses", expensesRoutes);

export default router;
