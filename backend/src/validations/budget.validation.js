import { z } from "zod";

export const budgetSchema = z.object({
  description: z
    .string({ error: "Description is required" })
    .min(2, { message: "Description is required" })
    .trim(),

  // Form inputs send strings; coerce handles both "1500" and 1500.
  // `error` covers missing/wrong-type (incl. NaN), `message` covers <= 0.
  amount: z
    .coerce.number({ error: "Amount must be a positive number" })
    .positive({ message: "Amount must be a positive number" }),

  method: z
    .string({ error: "Payment method is required" })
    .min(2, { message: "Payment method is required" }),
});
