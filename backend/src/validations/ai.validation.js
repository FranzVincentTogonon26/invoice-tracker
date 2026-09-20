import { z } from "zod";

// One scanned line sent for analysis. Mirrors the shape `useReceiptScan`
// normalizes (description / quantity / rate) plus the derived amount, so the
// prompt can quote the same numbers the review table shows.
const suggestionItemSchema = z.object({
  description: z
    .string({ error: "Line description is required" })
    .trim()
    .max(300, { message: "Line description is too long" })
    .optional(),

  quantity: z.coerce
    .number({ error: "Invalid quantity" })
    .nonnegative({ message: "Quantity must be zero or more" })
    .optional(),

  rate: z.coerce
    .number({ error: "Invalid rate" })
    .nonnegative({ message: "Rate must be zero or more" })
    .optional(),

  amount: z.coerce
    .number({ error: "Invalid amount" })
    .nonnegative({ message: "Amount must be zero or more" })
    .optional(),
});

// POST /ai/expense-suggest — the temporary receipt draft (vendor, date, scan
// list items) plus the category names the admin already has, analyzed into ONE
// description + category for the grouped expense line. Sending the existing
// names lets Gemini only ever answer with a category that exists;
// `categories` stays optional so the request still works before the category
// list has loaded.
export const expenseSuggestSchema = z.object({
  vendor: z
    .string({ error: "Invalid vendor" })
    .trim()
    .max(160, { message: "Vendor name is too long" })
    .optional(),

  // Empty string from the UI (no date on the receipt) is normalized to
  // undefined — otherwise the regex rejects "" with a confusing 400.
  date: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid receipt date" })
      .optional(),
  ),

  items: z
    .array(suggestionItemSchema, { error: "Line items are required" })
    .min(1, { message: "At least one line item is required" })
    .max(60, { message: "Too many line items to analyze" }),

  categories: z
    .array(
      z
        .string({ error: "Invalid category name" })
        .trim()
        .min(1, { message: "Category name is required" })
        .max(60, { message: "Category name is too long" }),
    )
    .max(80, { message: "Too many categories" })
    .optional(),
});
