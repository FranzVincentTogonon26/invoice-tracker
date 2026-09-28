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