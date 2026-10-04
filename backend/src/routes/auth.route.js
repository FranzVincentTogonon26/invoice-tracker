import express from "express";
import * as authController from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Brute-force / enumeration guards (per IP; the OTP attempt cap inside the
// controller adds a per-email layer on top of these).
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many login attempts. Please try again later.",
  code: "LOGIN_RATE_LIMITED",
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many registration attempts. Please try again later.",
  code: "REGISTER_RATE_LIMITED",
});
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many verification attempts. Please try again later.",
  code: "OTP_RATE_LIMITED",
});

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/issued-otp", otpLimiter, authController.issuedOtp);
router.post("/verify-otp", otpLimiter, authController.verifyOtp);
router.post("/resend-otp", otpLimiter, authController.resendOtp);

// Protected Routes
router.get("/me", authMiddleware, authController.getCurrentUser);

export default router;
