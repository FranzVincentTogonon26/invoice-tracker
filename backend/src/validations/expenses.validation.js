import { z } from "zod";

// One line item in the Add Expenses form. `expense_date` is the `YYYY-MM-DD`
// string the DatePicker emits; pg casts it to DATE via `$n::date`.
export const expenseItemSchema = z.object({
  description: z
    .string({ error: "Description is required" })
    .trim()
    .min(2, { message: "Description is required" }),

  // Empty string from the UI (no category selected yet) is normalized to
  // undefined — otherwise `.uuid()` rejects "" with a confusing 400.
  category_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.uuid({ message: "Invalid category id" }).optional(),
  ),

  expense_date: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid expense date" })
      .optional(),
  ),

  total_amount: z.coerce
    .number({ error: "Amount is required" })
    .nonnegative({ message: "Amount must be zero or more" }),

  receipt_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.uuid({ message: "Invalid receipt id" }).optional(),
  ),

  notes: z.string().trim().optional(),

  payment_method: z
    .enum(["cash", "bank_transfer", "e_wallet", "cheque"], {
      message: "Invalid payment method",
    })
    .optional(),
});

// Single create endpoint discriminated by `type` — same pattern the budget
// module uses for POST /budgets:
//   expense  → { items: [...] }                (Add Expenses save)
//   category → { category_name }               (ExpensesModal "category")
//   receipt  → { description, qty, rate, ... } (ExpensesModal "scan_receipt")
export const createExpensesSchema = z
  .object({
    type: z.enum(["expense", "category", "receipt"], {
      error: "Expense type is required",
    }),

    // ── type: "expense" ──────────────────────────────────────────
    items: z.array(expenseItemSchema).optional(),
    // Optional budget issuance the lines belong to. Admins logging expenses
    // manually have no issued reference, so it stays nullable.
    issued_ref_id: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.uuid({ message: "Invalid issued reference id" }).optional(),
      ),

    // ── type: "category" ─────────────────────────────────────────
    category_name: z
      .string({ error: "Category name is required" })
      .trim()
      .min(1, { message: "Category name is required" })
      .max(60, { message: "Category name is too long" })
      .optional(),

    // ── type: "receipt" (scan_receipt) ───────────────────────────
    // `image_url` carries the uploaded image as a data URL (the receipt table
    // has no file storage behind it yet).
    description: z
      .string({ error: "Receipt description is required" })
      .trim()
      .min(2, { message: "Receipt description is required" })
      .optional(),
    qty: z.coerce
      .number({ error: "Quantity must be at least 1" })
      .int({ message: "Quantity must be a whole number" })
      .positive({ message: "Quantity must be at least 1" })
      .optional(),
    rate: z.coerce
      .number({ error: "Rate must be greater than zero" })
      .positive({ message: "Rate must be greater than zero" })
      .optional(),
    amount: z.coerce
      .number({ error: "Amount must be zero or more" })
      .nonnegative({ message: "Amount must be zero or more" })
      .optional(),
    image_url: z.string().optional(),
  })
  .refine(
    (data) => data.type !== "expense" || (data.items?.length ?? 0) > 0,
    { message: "At least one expense line is required", path: ["items"] },
  )
  .refine((data) => data.type !== "category" || Boolean(data.category_name), {
    message: "Category name is required",
    path: ["category_name"],
  })
  .refine((data) => data.type !== "receipt" || Boolean(data.description), {
    message: "Receipt description is required",
    path: ["description"],
  })
  .refine(
    (data) =>
      data.type !== "receipt" ||
      (Boolean(data.qty) && Boolean(data.rate) && data.amount != null),
    { message: "Quantity, rate and amount are required" },
  );
