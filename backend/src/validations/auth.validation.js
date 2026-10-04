import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, {
    message: "Name is required",
  }),

  email: z.email({
    message: "Invalid email address",
  }),

  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters",
    })
    // bcrypt silently truncates past 72 bytes and hashing megabytes burns
    // CPU per request — cap length before it ever reaches bcrypt.
    .max(72, {
      message: "Password must be at most 72 characters",
    }),
});
export const loginSchema = z.object({
  email: z.email({
    message: "Invalid email address",
  }),

  password: z
    .string()
    .min(6, {
      message: "Password must be at least 6 characters",
    })
    .max(72, {
      message: "Password must be at most 72 characters",
    }),
});

export const verifyOtpSchema = z.object({
  email: z.email({
    message: "Invalid email address",
  }),

  otp: z
    .string()
    .regex(/^\d{6}$/, {
      message: "Verification code must be 6 digits",
    }),
});

export const resendOtpSchema = z.object({
  name: z.string().min(2, {
    message: "Name is required",
  }),
  email: z.email({
    message: "Invalid email address",
  }),
});
