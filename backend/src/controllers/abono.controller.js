import Abono from "../models/abono.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { emitTransaction } from "../realtime/index.js";
import {
  createAbonoSchema,
  settleAbonoSchema,
  updateAbonoDescriptionSchema,
} from "../validations/abono.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Row-level access for the single-abono endpoints (update / delete): admins
// may touch any row; everyone else must be an *active employee* and the owner
// of that row. A rejected caller gets the plain "not found" instead of a 403
// so the response never reveals that someone else's abono id exists (same
// rule as expenses.controller.js).
const canTouchRow = (req, abono) => {
  if (req.user?.role === "admin") return true;
  return (
    req.user?.role === "employee" &&
    req.user?.status === "active" &&
    String(abono?.user_id ?? "") === String(req.user?.id ?? "")
  );
};

// GET /abono — employees only ever see their own ledger (scoped by the
// token's user_id); admins get the full list across employees.
export const abono = async (req, res, next) => {
  try {
    if (req.user.role === "employee") {
      const { abono: rows, overview } = await Abono.employeeAbonoOverview(
        req.user.id,
      );
      return res.status(200).json({ abono: rows, overview });
    }

    // Deny by default: only admins get the full list — any other
    // (current or future) role must not inherit it silently.
    if (req.user.role !== "admin") {
      throw ApiError.forbidden("Admin access required.", "ADMIN_ACCESS_REQUIRED");
    }

    const rows = await Abono.listAll(req.query);
    return res.status(200).json({ abono: rows });
  } catch (err) {
    next(err);
  }
};

// GET /abono/employee — the Abono page: rows from employee_abono for the
// signed-in user plus the hero/mini-stat overview. `user_id` comes from the
// verified JWT (requireEmployeeAccess already proved role + status), so the
// list can never be pointed at another employee's rows.
export const abonoEmployee = async (req, res, next) => {
  try {
    const { abono: rows, overview } = await Abono.employeeAbonoOverview(
      req.user.id,
    );
    return res.status(200).json({ abono: rows, overview });
  } catch (err) {
    next(err);
  }
};

// POST /abono — the Add Abono modal sends { description, amount }. The
// source of funds is resolved server-side: an explicitly passed reference_id
// must be one the employee holds as an OPEN issuance, otherwise the oldest
// open issuance is used (see Abono.defaultReferenceForUser).
export const create = async (req, res, next) => {
  try {
    const payload = validate(createAbonoSchema, req.body);

    let referenceId = payload.reference_id ?? null;
    if (referenceId) {
      const held = await Abono.holdsOpenReference(req.user.id, referenceId);
      if (!held) {
        throw ApiError.badRequest(
          "That source of funds is not one of your open budget issuances.",
          "VALIDATION_ERROR",
        );
      }
    } else {
      const fallback = await Abono.defaultReferenceForUser(req.user.id);
      if (!fallback) {
        throw ApiError.badRequest(
          "No budget has been issued to you yet, so an abono can't be recorded.",
          "NO_BUDGET_REFERENCE",
        );
      }
      referenceId = fallback.reference_id;
    }

    const abono = await Abono.create({
      user_id: req.user.id,
      reference_id: referenceId,
      amount: payload.amount,
      description: payload.description,
    });
    emitTransaction({
      action: "create",
      entity: "abono",
      actor: req.user,
      message: `${req.user.name ?? "Employee"} recorded abono "${payload.description}" (${payload.amount}).`,
      metadata: { amount: payload.amount, userId: req.user.id, reference_id: referenceId, abonoId: abono?.id ?? null },
      notifyUserIds: [req.user.id],
    });
    return res.status(201).json({ abono, message: "Abono added." });
  } catch (err) {
    next(err);
  }
};

// PATCH /abono/:id/description — the double-click inline editing in the
// transaction sheet / details portal.
export const updateDescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid abono id", "VALIDATION_ERROR");

    const payload = validate(updateAbonoDescriptionSchema, req.body);

    // Same ownership rule as the delete below — an employee may only touch
    // their own row (admins keep the full ledger), and a stranger sees
    // "not found", never a 403 that would confirm the id exists.
    const existing = await Abono.findById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    const abono = await Abono.updateDescription(id, payload.description);
    if (!abono)
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    emitTransaction({
      action: "update",
      entity: "abono",
      actor: req.user,
      message: `Updated abono description (${id}).`,
      metadata: { id, userId: abono.user_id ?? existing?.user_id ?? null },
      notifyUserIds: (abono.user_id ?? existing?.user_id) ? [abono.user_id ?? existing.user_id] : [],
    });

    return res.status(200).json({ abono, message: "Description updated." });
  } catch (err) {
    next(err);
  }
};

// DELETE /abono/:id — the row action's "Delete abono": removes the record
// outright (abono has no soft-delete state; the status column tracks the
// reimbursement lifecycle, not deletions). Guard: an OPEN abono funds the
// spendable pool, so when its amount has already been spent (remaining
// balance can't cover it) the delete is rejected — removing it would
// overdraw the employee. Draft/settled rows never fund the pool and stay
// deletable.
export const removeAbono = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid abono id", "VALIDATION_ERROR");

    const existing = await Abono.findById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    if (existing.status === "open") {
      const totalBalance = await Abono.spendableBalance(existing.user_id);
      const remaining =
        Math.round((Number(totalBalance) || 0) * 100) / 100 -
        (Math.round((Number(existing.amount) || 0) * 100) / 100);
      if (remaining < -0.004) {
        throw ApiError.badRequest(
          "The amount of this abono has already been spent, so it can't be deleted.",
          "ABONO_ALREADY_SPENT",
        );
      }
    }

    const abono = await Abono.remove(id);
    if (!abono)
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    emitTransaction({
      action: "delete",
      entity: "abono",
      actor: req.user,
      message: `Deleted abono "${abono.description ?? id}" (${abono.amount ?? "?"}).`,
      metadata: { id, amount: abono.amount ?? null, userId: abono.user_id ?? existing?.user_id ?? null },
      notifyUserIds: (abono.user_id ?? existing?.user_id) ? [abono.user_id ?? existing.user_id] : [],
    });

    return res.status(200).json({ abono, message: "Abono deleted." });
  } catch (err) {
    next(err);
  }
};

// PATCH /abono/settle — the Settle Abono dialog: every OPEN row the employee
// checked flips to 'settled' with `date_settled` stamped, in ONE transaction.
// Scope is the token's user id (an employee can only settle their own rows).
// The server re-checks the remaining balance before writing: when the request
// can't be covered the answer is the insufficient-balance 400 the dialog
// already previews client-side, and nothing is committed.
export const settleAbono = async (req, res, next) => {
  try {
    const payload = validate(settleAbonoSchema, req.body);

    const { insufficient, requested, totalBalance, settled } =
      await Abono.settleOpen(req.user.id, payload.ids);

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
      message: `${req.user.name ?? "Employee"} settled ${settled.length} abono (${requested ?? ""}).`,
      metadata: { count: settled.length, amount: requested ?? null, userId: req.user.id, ids: settled.map((r) => r.id ?? null).filter(Boolean) },
      notifyUserIds: [req.user.id],
    });

    return res.status(200).json({
      settled,
      requested,
      totalBalance,
      message:
        settled.length === 1
          ? "Abono settled."
          : `${settled.length} abono settled.`,
    });
  } catch (err) {
    next(err);
  }
};
