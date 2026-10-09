import { z } from "zod";

// One abono record from the Add Abono modal — what the out-of-pocket spend
// was for and how much the employee paid. `reference_id` is optional: when
// omitted (the modal never sends it) the controller books the abono against
// the employee's oldest open budget issuance — `employee_abono.reference_id`
// is a NOT NULL FK, so a source of funds always has to resolve.
export const createAbonoSchema = z.object({
  description: z
    .string({ error: "Description is required" })
    .trim()
    .min(2, { message: "Description must be at least 2 characters" })
    .max(200, { message: "Description is too long" }),

  amount: z.coerce
    .number({ error: "Amount is required" })
    .positive({ message: "Amount must be greater than zero" })
    .max(999999999.99, { message: "Amount is too large" }),

  reference_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.uuid({ message: "Invalid budget reference id" }).optional(),
  ),
});

// Description update for the double-click inline editing in the transaction
// sheet / details portal — mirrors updateExpenseDescriptionSchema.
export const updateAbonoDescriptionSchema = z.object({
  description: z
    .string({ error: "Description is required" })
    .trim()
    .min(2, { message: "Description must be at least 2 characters" })
    .max(200, { message: "Description is too long" }),
});

// Settle Abono — the ids of the OPEN rows the employee checked in the Settle
// dialog. At least one id (an empty selection is a client bug, not a request),
// capped so one call can't carry an unbounded list.
export const settleAbonoSchema = z.object({
  ids: z
    .array(z.uuid({ message: "Invalid abono id" }), {
      error: "Select at least one abono to settle",
    })
    .min(1, { message: "Select at least one abono to settle" })
    .max(500, { message: "Too many abono records in one request" }),
});

// Admin settlement (reimbursement personnel table): the employee whose abono
// is settled, the checked OPEN row ids, the payment method booked on the
// settlement issuance rows, and an optional note stored on them.
export const settleAbonoForEmployeeSchema = z.object({
  user_id: z.uuid({ message: "Invalid employee id" }),
  ids: z
    .array(z.uuid({ message: "Invalid abono id" }), {
      error: "Select at least one abono to settle",
    })
    .min(1, { message: "Select at least one abono to settle" })
    .max(500, { message: "Too many abono records in one request" }),
  method: z.enum(["cash", "bank_transfer", "e_wallet"], {
    message: "Invalid settlement method",
  }),
  note: z.string().trim().max(150).optional().nullable(),
  // Optional custom amount (partial settlement): settles this much across
  // the checked rows, oldest first. Omitted (or equal to the checked total)
  // settles the checked rows in full.
  amount: z
    .number({ error: "Invalid settlement amount" })
    .positive({ message: "Settlement amount must be greater than zero" })
    .max(999999999, { message: "Settlement amount is too large" })
    .optional(),
});