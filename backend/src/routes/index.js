import express from "express";
import authRoutes from "./auth.route.js";
import budgetRoutes from "./budget.route.js";

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

export default router;
