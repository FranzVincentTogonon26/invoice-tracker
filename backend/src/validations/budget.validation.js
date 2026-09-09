import { z } from "zod";

export const budgetSchema = z.object({
  description: z.string().min(2, {
    message: "Description is required",
  }),

  amount: z.number().positive({
    message: "Amount must be a positive number",
  }),

  method: z.string().min(2, {
    message: "Payment method is required",
  }),
});
