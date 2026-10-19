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
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many password reset attempts. Please try again later.",
  code: "FORGOT_RATE_LIMITED",
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many password reset attempts. Please try again later.",
  code: "RESET_RATE_LIMITED",
});

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/issued-otp", otpLimiter, authController.issuedOtp);
router.post("/verify-otp", otpLimiter, authController.verifyOtp);
router.post("/resend-otp", otpLimiter, authController.resendOtp);

// Forgot password — role-aware reset flow (admins verify an emailed code,
// employees set the new password directly once the email is validated)
router.post("/forgot-password", forgotLimiter, authController.forgotPassword);
router.post(
  "/forgot-password/verify-otp",
  otpLimiter,
  authController.verifyResetOtp,
);
router.post(
  "/forgot-password/resend-otp",
  otpLimiter,
  authController.resendResetOtp,
);
router.post("/forgot-password/reset", resetLimiter, authController.resetPassword);

// Protected Routes
router.get("/me", authMiddleware, authController.getCurrentUser);

export default router;
