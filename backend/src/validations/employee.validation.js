import { z } from "zod";

export const createEmployeeSchema = z.object({
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
    // Same bcrypt cap as registration (see auth.validation.js).
    .max(72, {
      message: "Password must be at most 72 characters",
    }),
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(["active", "inactive"], {
    message: "Status must be either 'active' or 'inactive'",
  }),
});