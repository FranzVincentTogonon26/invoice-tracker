import { z } from "zod";

// POST /budget-transfer — moves spendable funds from the signed-in account
// to another active employee. `method` defaults to "cash" (empty string from
// the UI is normalized to undefined so the default applies); `notes` is a
// free-form textarea capped so one row can't carry an unbounded blob.
export const createBudgetTransferSchema = z.object({
  transfer_to: z
    .string({ error: "Select an employee to transfer to" })
    .uuid({ message: "Invalid employee id" }),

  amount: z.coerce
    .number({ error: "Amount is required" })
    .positive({ message: "Amount must be greater than zero" })
    .max(999999999.99, { message: "Amount is too large" }),

  method: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .enum(["cash", "bank_transfer", "e_wallet"], {
        error: "Invalid payment method",
      })
      .default("cash"),
  ),

  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .max(500, { message: "Notes are too long (max 500 characters)" })
      .optional(),
  ),
});
