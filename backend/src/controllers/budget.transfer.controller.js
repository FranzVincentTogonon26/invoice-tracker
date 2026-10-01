import BudgetTransfer from "../models/budget.transfer.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
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
