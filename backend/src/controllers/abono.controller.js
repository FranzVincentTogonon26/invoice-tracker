import Abono from "../models/abono.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import {
  createAbonoSchema,
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

    return res.status(200).json({ abono, message: "Description updated." });
  } catch (err) {
    next(err);
  }
};

// DELETE /abono/:id — the row action's "Delete abono": removes the record
// outright (abono has no soft-delete state; the status column tracks the
// reimbursement lifecycle, not deletions).
export const removeAbono = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid abono id", "VALIDATION_ERROR");

    const existing = await Abono.findById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    const abono = await Abono.remove(id);
    if (!abono)
      throw ApiError.notFound("Abono not found", "ABONO_NOT_FOUND");

    return res.status(200).json({ abono, message: "Abono deleted." });
  } catch (err) {
    next(err);
  }
};
