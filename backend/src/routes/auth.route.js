import express from "express";
import * as authController from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected Routes
router.get("/me", authMiddleware, authController.getCurrentUser);

export default router;
