import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/user.model.js";
import Otp from "../models/otp.model.js";
import ApiError from "../utils/ApiError.js";
import jwtToken from "../utils/jwt.js";
import { validate } from "../utils/validate.js";
import { sendOtpEmail, OTP_EXPIRY_MINUTES } from "../utils/mailer.js";
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from "../validations/auth.validation.js";

// Strips sensitive fields before a user object is returned to clients
const sanitize = ({ password, ...safe }) => safe;

const OTP_TTL_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_SALT_ROUNDS = 10;

// Each request must generate a FRESH code. A module-level code would be shared
// by every user, and its expiry would be frozen at server boot — after ~10
// minutes every verification would fail until the next restart.
const generateOtp = async () => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  return { code, otpHash, expiresAt };
};

const ensureUserCanLogin = (user) => {
  if (user.status === "active") return;

  if (user.status === "pending") {
    throw ApiError.forbidden(
      "Your account is awaiting administrator approval.",
      "ACCOUNT_PENDING",
    );
  }

  throw ApiError.forbidden(
    "Your account is inactive. Please contact an administrator.",
    "ACCOUNT_INACTIVE",
  );
};

const buildAuthResponse = (user) => {
  const token = jwtToken.sign({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { user: sanitize(user), token };
};

export const issuedOtp = async (req, res, next) => {
  try {
    const { email, name } = validate(resendOtpSchema, req.body);
    const { code, otpHash, expiresAt } = await generateOtp();

    await Otp.upsert({
      email,
      otpHash,
      expiresAt,
    });

    await sendOtpEmail({
      to: email,
      name,
      otp: code,
    });

    return res.json({
      message: `Successfully issued 6-digit verification code. Please check your email: ${email}`,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body);

    const user = await User.findUserByEmail(email);

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    ensureUserCanLogin(user);

    return res.json({
      ...buildAuthResponse(user),
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = validate(registerSchema, req.body);

    const existingUser = await User.findUserByEmail(email);

    if (existingUser) {
      throw ApiError.conflict("User with this email already exists.");
    }

    const user = await User.createUser({
      name,
      email,
      password,
    });

    if (user.role === "admin" && user.status === "active") {
      return res.json({
        ...buildAuthResponse(user),
      });
    }

    return res.json({
      message:
        "Email verified. Your account is awaiting administrator approval.",
    });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = validate(verifyOtpSchema, req.body);

    const record = await Otp.findByEmail(email);

    if (!record || new Date(record.expires_at) <= new Date()) {
      throw ApiError.badRequest("Expired verification code.", "OTP_EXPIRED");
    }

    const matches = await bcrypt.compare(otp, record.otp);

    if (!matches) {
      throw ApiError.badRequest("Invalid verification code.", "OTP_INVALID");
    }

    await Otp.deleteByEmail(email);
    return res.json({
      message: "Email verified successfully.",
    });
  } catch (err) {
    next(err);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    const { email, name } = validate(resendOtpSchema, req.body);

    const emailExist = await Otp.findByEmail(email);

    // Basic anti-spam cooldown while a code is still unverified
    if (
      emailExist &&
      Date.now() - new Date(emailExist.created_at).getTime() <
        OTP_RESEND_COOLDOWN_MS
    ) {
      throw ApiError.tooManyRequests(
        "Please wait a moment before requesting another code.",
        "OTP_RATE_LIMITED",
      );
    }

    if (emailExist) {
      const { code, otpHash, expiresAt } = await generateOtp();

      // Send first, then persist — if sending fails, the previous (still
      // valid) code is not lost, and the user can retry the resend.
      await Otp.upsert({ email, otpHash, expiresAt });
      await sendOtpEmail({ to: email, name, otp: code });

      return res.json({
        message: `Successfully issued 6-digit verification code. Please check your email: ${email}`,
      });
    }

    // Generic message — never reveal whether the account exists
    return res.json({
      message: "If that account exists, a new verification code is on its way.",
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findUserById(req.user.id);

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    ensureUserCanLogin(user);

    return res.json({ user });
  } catch (err) {
    next(err);
  }
};
