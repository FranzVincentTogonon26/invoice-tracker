import BudgetTransfer from "../models/budget.transfer.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { emitTransaction } from "../realtime/index.js";
import { createBudgetTransferSchema } from "../validations/budget.transfer.validation.js";

// Both admins and active employees may move funds — the route stacks only
// authMiddleware (valid token, real user, status = active). The role is
// re-checked here as well so a non-employee/non-admin token (or one whose
// status flipped after minting) is cut off even though it holds a valid JWT.
const ensureTransferAccess = async (req) => {
  const user = await User.findUserById(req.user.id);
  if (!user) throw ApiError.notFound("User not found", "USER_NOT_FOUND");
  if (user.status !== "active") {
    throw ApiError.forbidden(
      "Your account is not active. Please contact an administrator.",
      "ACCOUNT_NOT_ACTIVE",
    );
  }
  if (user.role !== "admin" && user.role !== "employee") {
    throw ApiError.forbidden(
      "Budget transfer access required.",
      "TRANSFER_ACCESS_REQUIRED",
    );
  }
  return user;
};

// GET /budget-transfer/overview — the form's data in one round-trip: the
// sender's spendable balance, their own account card, and the active-employee
// picker (never including themselves).
export const transferOverview = async (req, res, next) => {
  try {
    const user = await ensureTransferAccess(req);

    const [breakdown, employees] = await Promise.all([
      BudgetTransfer.balanceBreakdown(user.user_id, user.role),
      BudgetTransfer.transferableEmployees(user.user_id),
    ]);

    return res.status(200).json({
      me: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
        status: user.status,
      },
      employees,
      overview: breakdown,
    });
  } catch (err) {
    next(err);
  }
};

// POST /budget-transfer — validates the payload, then records the transfer in
// one transaction (single `budget_transfer` row, status 'success'; the
// recipient reads it through `transfer_to`). The server re-checks the
// remaining balance before writing: when the request can't be covered the
// answer is the insufficient-balance 400 the form already previews
// client-side, and nothing is committed.
export const create = async (req, res, next) => {
  try {
    const user = await ensureTransferAccess(req);
    const payload = validate(createBudgetTransferSchema, req.body);

    const result = await BudgetTransfer.createTransfer({
      senderId: user.user_id,
      senderRole: user.role,
      transferTo: payload.transfer_to,
      amount: payload.amount,
      notes: payload.notes ?? null,
      method: payload.method,
    });

    if (result.invalidRecipient) {
      throw ApiError.badRequest(
        "The selected employee is no longer available. Please choose another active employee.",
        "INVALID_RECIPIENT",
      );
    }

    if (result.noReference) {
      throw ApiError.badRequest(
        "No budget has been issued to you yet, so a transfer can't be recorded.",
        "NO_BUDGET_REFERENCE",
      );
    }

    if (result.insufficient) {
      throw ApiError.badRequest(
        "Cannot proceed your request due to insufficient balance — the transfer amount is more than what remains.",
        "INSUFFICIENT_BALANCE",
      );
    }

    emitTransaction({
      action: "transfer",
      entity: "transfer",
      actor: req.user,
      message: `${user.name} transferred ${payload.amount} to employee (${payload.transfer_to}).`,
      metadata: { amount: payload.amount, senderId: user.user_id, transferTo: payload.transfer_to, transferId: result.transfer?.id ?? null, method: payload.method },
      notifyUserIds: [user.user_id, payload.transfer_to],
    });

    return res.status(201).json({
      transfer: result.transfer,
      requested: result.requested,
      totalBalance: result.totalBalance,
      message: "Budget transferred successfully.",
    });
  } catch (err) {
    next(err);
  }
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Row-level access for the cancel endpoint: admins may cancel any transfer;
// everyone else must be an *active employee* and the sender of that transfer
// (a recipient can never cancel money sent to them). A rejected caller gets
// the plain "not found" instead of a 403 so the response never reveals that
// someone else's transfer id exists (same rule as abono.controller.js).
const canTouchTransfer = (req, transfer) => {
  if (req.user?.role === "admin") return true;
  return (
    req.user?.role === "employee" &&
    req.user?.status === "active" &&
    String(transfer?.user_id ?? "") === String(req.user?.id ?? "")
  );
};

// DELETE /budget-transfer/:id — the sheet's "Cancel budget transfer":
// removes the record outright. Guard: deleting takes the received amount back
// out of the recipient's pool, so when they already spent it the cancel is
// rejected — removing it would overdraw them.
export const remove = async (req, res, next) => {
  try {
    await ensureTransferAccess(req);
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid transfer id", "VALIDATION_ERROR");

    const existing = await BudgetTransfer.findById(id);
    if (!existing || !canTouchTransfer(req, existing))
      throw ApiError.notFound("Transfer not found", "TRANSFER_NOT_FOUND");

    const result = await BudgetTransfer.cancelTransfer(id);
    if (result.notFound)
      throw ApiError.notFound("Transfer not found", "TRANSFER_NOT_FOUND");

    if (result.recipientSpent) {
      throw ApiError.badRequest(
        "Cannot cancel this transfer — the recipient has already spent the transferred amount.",
        "TRANSFER_ALREADY_SPENT",
      );
    }

    emitTransaction({
      action: "delete",
      entity: "transfer",
      actor: req.user,
      message: `Cancelled budget transfer (${result.transfer?.id ?? id}).`,
      metadata: { id, amount: result.transfer?.amount ?? existing?.amount ?? null, senderId: existing?.user_id ?? null, transferTo: existing?.transfer_to ?? null },
      notifyUserIds: [existing?.user_id, existing?.transfer_to].filter(Boolean),
    });

    return res.status(200).json({
      transfer: result.transfer,
      message: "Budget transfer cancelled.",
    });
  } catch (err) {
    next(err);
  }
};
