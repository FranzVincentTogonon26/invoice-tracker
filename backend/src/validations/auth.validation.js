import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, {
    message: "Name is required",
  }),

  email: z.email({
    message: "Invalid email address",
  }),

  password: z.string().min(6, {
    message: "Password must be at least 6 characters",
  }),
});

export const loginSchema = z.object({
  email: z.email({
    message: "Invalid email address",
  }),

  password: z.string().min(6, {
    message: "Password must be at least 6 characters",
  }),
});
