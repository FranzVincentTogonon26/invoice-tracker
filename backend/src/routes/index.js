import express from "express";
import authRoutes from "./auth.route.js";
import budgetRoutes from "./budget.route.js";
import employeesRoutes from "./employees.route.js";
import expensesRoutes from "./expenses.route.js";
import budgetTransferRoutes from "./budget.transfer.route.js";
import abonoRoutes from "./abono.route.js";
import employeeReimbursementRoutes from "./employee-reimbursements.route.js";
import transactionsRoutes from "./transactions.route.js";
import auditRoutes from "./audit.route.js";
import aiRoutes from "./ai.route.js";
import sourceOfFundsRoutes from "./source.of.funds.route.js";
import employeeOverviewRoutes from "./employee.overview.route.js";
import employeeSettingsRoutes from "./employee.settings.route.js";

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
router.use("/budget-transfer", budgetTransferRoutes);
router.use("/abono", abonoRoutes);
router.use("/employee-reimbursements", employeeReimbursementRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/ai", aiRoutes);
router.use("/source-of-funds", sourceOfFundsRoutes);
router.use("/employee_overview", employeeOverviewRoutes);
router.use("/employee_settings", employeeSettingsRoutes);

export default router;
