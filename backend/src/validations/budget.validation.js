import { z } from "zod";

export const createbudgetSchema = z
  .object({
    // Drives which table `POST /budgets` writes to. Without this field
    // zod stripped it, so `type` was always undefined and every request
    // fell through to the addBudget (budget table) branch.
    type: z.enum(["addBudget", "issuedBudget", "addBudgetReference"], {
      error: "Transaction type is required",
    }),

    // Empty string from the UI (no reference selected yet) is normalized to
    // undefined — otherwise `.uuid()` rejects "" with a confusing 400.
    reference_id: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z
          .string({ error: "Invalid reference id" })
          .uuid({ message: "Invalid reference id" })
          .optional(),
      ),

    employeeId: z
      .string({ error: "Invalid employee id" })
      .uuid({ message: "Invalid employee id" })
      .optional(),

    // Required only for addBudget / issuedBudget (validated per-type below)
    description: z
      .string({ error: "Description is required" })
      .min(2, { message: "Description is required" })
      .trim()
      .optional(),

    amount: z.coerce
      .number({ error: "Amount must be a positive number" })
      .positive({ message: "Amount must be a positive number" })
      .optional(),

    method: z
      .string({ error: "Payment method is required" })
      .min(2, { message: "Payment method is required" })
      .optional(),

    // Required only for addBudgetReference (ReferencesModal)
    label: z
      .string({ error: "Reference label is required" })
      .min(1, { message: "Reference label is required" })
      .trim()
      .optional(),

    // Optional field used only by issuedBudget (DB column: notes).
    note: z.string().optional(),
    approved: z.string().optional(),
  })
  .refine((data) => data.type !== "issuedBudget" || Boolean(data.employeeId), {
    message: "Employee is required",
    path: ["employeeId"],
  })
  // addBudget / issuedBudget need description + amount + method;
  // addBudgetReference only needs a label.
  .refine(
    (data) =>
      data.type === "addBudgetReference" ||
      (Boolean(data.description) &&
        data.amount != null &&
        Boolean(data.method)),
    { message: "Description, amount and method are required" },
  )
  .refine((data) => data.type !== "addBudget" || Boolean(data.reference_id), {
    message: "Budget reference is required",
    path: ["reference_id"],
  })
  .refine((data) => data.type !== "addBudgetReference" || Boolean(data.label), {
    message: "Reference label is required",
    path: ["label"],
  });
