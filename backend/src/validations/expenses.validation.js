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

  // The budget reference the line is funded from — the Add Expenses save
  // sends it per line; NULL falls back to the payload's top-level
  // `reference_id` in the model.
  reference_id: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.uuid({ message: "Invalid budget reference id" }).optional(),
    ),

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

  // The scan's attachment / date can also travel on the line itself; the model
  // falls back to the payload-level values when they are absent. Declared here
  // so zod does not silently strip them off an expense line.
  image_url: z.string().optional(),
  receipt_date: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid receipt date" })
      .optional(),
  ),
});

// One scanned line item — { description, qty, rate, amount }. Shared by the
// receipt draft parked in localStorage (receiptDraftSchema) and by the `items`
// key for `type: "receipt"` lines.
export const receiptLineItemSchema = z.object({
  description: z.string().trim().optional(),
  qty: z.coerce.number().nonnegative().optional(),
  rate: z.coerce.number().nonnegative().optional(),
  amount: z.coerce.number().nonnegative().optional(),
});

// One scanned receipt draft parked in localStorage by ReceiptDraftModal and
// sent along with the expense lines on save. `receipt_id` is the draft id the
// frontend generated (a UUID); the backend stores it verbatim, keyed for the
// expenses.receipt_id → receipt(receipt_id) lookup. The draft's attachment and
// receipt date do NOT travel here: they ride on each expense line
// (`expenseItemSchema.image_url` / `.receipt_date`) and are stored on `expenses`.
export const receiptDraftSchema = z.object({
  receipt_id: z.uuid({ message: "Invalid receipt id" }),

  vendor: z.string().trim().optional(),

  // Scanned line items — { description, qty, rate, amount } each.
  items: z.array(receiptLineItemSchema).optional(),
});

// Single create endpoint discriminated by `type` — same pattern the budget
// module uses for POST /budgets:
//   expense  → { items: [...], receipts: [...] } (Add Expenses save)
//   category → { category_name }                 (ExpensesModal "category")
//   receipt  → { description, qty, rate, ... }   (ExpensesModal "scan_receipt")
export const createExpensesSchema = z
  .object({
    type: z.enum(["expense", "category", "receipt"], {
      error: "Expense type is required",
    }),

    // ── type: "expense" ──────────────────────────────────────────
    // ONE `items` key for both flows: expense lines validate against
    // `expenseItemSchema` (strict — description + total_amount), scanned
    // receipt lines against `receiptLineItemSchema`. Declaring `items` twice
    // would let the last definition win and silently strip `total_amount`
    // (and the other expense-only columns) from every saved line.
    items: z
      .array(z.union([expenseItemSchema, receiptLineItemSchema]))
      .optional(),
    // Scanned receipt drafts parked in localStorage — written to the `receipt`
    // table in the same transaction that saves the lines, then each line's
    // `receipt_id` is re-pointed at the stored row.
    receipts: z.array(receiptDraftSchema).optional(),
    // Optional budget issuance the lines belong to. Admins logging expenses
    // manually have no issued reference, so it stays nullable.
    issued_ref_id: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.uuid({ message: "Invalid issued reference id" }).optional(),
      ),

    // The budget reference the lines are funded from (SelectSourceFund). Empty
    // string = nothing picked → undefined → stored as NULL.
    reference_id: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.uuid({ message: "Invalid budget reference id" }).optional(),
      ),

    // ── type: "category" ─────────────────────────────────────────
    category_name: z
      .string({ error: "Category name is required" })
      .trim()
      .min(1, { message: "Category name is required" })
      .max(60, { message: "Category name is too long" })
      .optional(),

    // ── type: "receipt" (scan_receipt) ───────────────────────────
    // Optional draft id — when present it is stored verbatim so expense lines
    // can reference the receipt by `receipt_id`.
    receipt_id: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.uuid({ message: "Invalid receipt id" }).optional(),
    ),
    vendor: z.string().trim().optional(),
    receipt_date: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid receipt date" })
        .optional(),
    ),
    // Scanned line items go through the shared `items` union above (declared
    // before `receipt_date`) — createReceipt loops over them by description,
    // inserting one receipt row per item.
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
  // `items` is a union, so a malformed expense line could still satisfy the
  // lenient receipt shape (which has no `total_amount`). Re-check every line
  // of an expense save here so it fails loudly instead of saving a 0 amount.
  .refine(
    (data) =>
      data.type !== "expense" ||
      (data.items ?? []).every(
        (item) =>
          item.total_amount != null &&
          (item.description?.trim().length ?? 0) >= 2,
      ),
    {
      message: "Each expense line needs a description and an amount",
      path: ["items"],
    },
  )
  .refine((data) => data.type !== "category" || Boolean(data.category_name), {
    message: "Category name is required",
    path: ["category_name"],
  })
  .refine(
    (data) =>
      data.type !== "receipt" ||
      Boolean(data.description) ||
      (data.items?.length ?? 0) > 0,
    {
      message: "Receipt description is required",
      path: ["description"],
    },
  )
  .refine(
    (data) =>
      data.type !== "receipt" ||
      (data.items?.length ?? 0) > 0 ||
      (Boolean(data.qty) && Boolean(data.rate) && data.amount != null),
    { message: "Quantity, rate and amount are required" },
  );
