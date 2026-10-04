import { z } from "zod";

// Setting → Account save payload. The form is submitted as multipart (the
// avatar photo rides along in the same request), so both fields arrive as
// strings. `remove_avatar` is a separate multipart flag handled by the
// controller — it is not part of this schema.
export const updateAccountSchema = z.object({
  name: z.string().min(2, {
    message: "Name is required",
  }),

  email: z.email({
    message: "Invalid email address",
  }),
});

// Setting → Password save payload. `current_password` follows the login
// schema's minimum and `new_password` the register schema's, so the rules the
// account was created with stay the rules it is changed with.
export const updatePasswordSchema = z.object({
  current_password: z
    .string()
    .min(6, {
      message: "Current password must be at least 6 characters",
    })
    .max(72, {
      message: "Current password must be at most 72 characters",
    }),

  new_password: z
    .string()
    .min(8, {
      message: "New password must be at least 8 characters",
    })
    .max(72, {
      message: "New password must be at most 72 characters",
    }),
});
