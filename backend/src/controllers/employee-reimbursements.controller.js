import EmployeeReimbursement from "../models/employee-reimbursement.model.js";
import Abono from "../models/abono.model.js";
import Budget from "../models/budget.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { emitTransaction } from "../realtime/index.js";
import {
  settleAbonoForEmployeeSchema,
  submitReimbursementSchema,
} from "../validations/abono.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /employee-reimbursements — every abono row across employees, same
// shape as the admin abono ledger (searchable by description, employee and
// source label).
export async function list(req, res, next) {
  try {
    const rows = await EmployeeReimbursement.list(req.query ?? {});
    return res.status(200).json({ reimbursements: rows });
  } catch (err) {
    return next(err);
  }
}

// GET /employee-reimbursements/overview — admin-only fund-pool totals, open
// abono by employee, chart timeline and the per-personnel ledger.
export async function overview(req, res, next) {
  try {
    const data = await EmployeeReimbursement.overview();
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

// POST /employee-reimbursements/submit — admin finalizes an employee's
// reimbursement: every OPEN issuance reference they hold flips to 'close'.
// Their issued amounts leave every money sum and they disappear from
// open-issuance ledgers (a future issuance starts fresh). The optional `note`
// body field is stamped onto each closed record (`notes`), and each record's
// leftover at close time is stored (`balance_forwarded`, 0 stays 0).
export async function submit(req, res, next) {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");

    const { note } = validate(submitReimbursementSchema, req.body ?? {});
    const trimmedNote = note?.trim() ? note.trim() : null;

    const { closedCount } = await Budget.closeOpenIssuedReferences(id, {
      note: trimmedNote,
    });

    emitTransaction({
      action: "status",
      entity: "reimbursement",
      actor: req.user,
      message: `Submitted reimbursement for ${id} (${closedCount} issuance${closedCount === 1 ? "" : "s"} closed).`,
      metadata: { userId: id, closedCount, note: trimmedNote },
      notifyUserIds: [id],
    });

    return res.status(200).json({
      closedCount,
      message:
        closedCount > 0
          ? `Reimbursement submitted — ${closedCount} issuance${closedCount === 1 ? "" : "s"} closed.`
          : "Nothing open to close — reimbursement submitted.",
    });
  } catch (err) {
    return next(err);
  }
}

// POST /employee-reimbursements/settle — admin settles an employee's checked
// OPEN abono rows: each flips to 'settled' (stamping `date_settled`) and its
// amount is booked back as an `issued_budget` row under the same budget
// reference. Refuses with 400 when the employee's balance can't cover the
// checked total, or when none of the rows are still open.
export async function settleAbono(req, res, next) {
  try {
    const payload = validate(settleAbonoForEmployeeSchema, req.body);

    const { insufficient, requested, totalBalance, settled, issued } =
      await Abono.settleAndReissue(payload.user_id, payload.ids, {
        method: payload.method,
        note: payload.note?.trim() || null,
        amount: payload.amount ?? null,
      });

    if (insufficient) {
      throw ApiError.badRequest(
        "Cannot proceed your request due to insufficient balance — the checked abono is more than what remains.",
        "INSUFFICIENT_BALANCE",
      );
    }

    if (settled.length === 0) {
      throw ApiError.badRequest(
        "None of the checked abono are still open.",
        "NOTHING_TO_SETTLE",
      );
    }

    emitTransaction({
      action: "settle",
      entity: "abono",
      actor: req.user,
      message: `Settled ${settled.length} abono (${requested ?? ""}) for ${payload.user_id}.`,
      metadata: {
        count: settled.length,
        amount: requested ?? null,
        userId: payload.user_id,
        ids: settled.map((r) => r.id ?? null).filter(Boolean),
      },
      notifyUserIds: [payload.user_id],
    });

    return res.status(200).json({
      settled,
      issued,
      requested,
      totalBalance,
      message: `Settled ${settled.length} abono and re-issued ${requested ?? ""} to the pool.`,
    });
  } catch (err) {
    return next(err);
  }
}
