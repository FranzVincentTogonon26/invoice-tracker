import Employee from "../models/employee.model.js";
import User from "../models/user.model.js";
import EmployeeOverview from "../models/employee.overview.model.js";
import Budget from "../models/budget.model.js";
import Expenses from "../models/expenses.model.js";
import Abono from "../models/abono.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { emitTransaction, emitForceLogout } from "../realtime/index.js";
import { deleteAvatarImage, saveAvatarImage } from "../utils/avatarImage.js";
import {
  createEmployeeSchema,
  updateEmployeeStatusSchema,
} from "../validations/employee.validation.js";

// Shared UUID shape check for path params (same regex the other handlers use).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const create = async (req, res, next) => {
  try {
    const { name, email, password } = validate(createEmployeeSchema, req.body);

    const existingUser = await Employee.findEmployeeByEmail(email);
    if (existingUser) {
      throw ApiError.conflict(
        "An account with this email already exists.",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const employee = await Employee.createEmployee({
      name: String(name).trim(),
      email: String(email).trim(),
      password,
    });

    emitTransaction({
      action: "create",
      entity: "employee",
      actor: req.user,
      message: `Added employee ${employee?.name ?? email}.`,
      metadata: { userId: employee?.user_id ?? employee?.id ?? null, email },
      adminOnly: true,
    });

    return res
      .status(201)
      .json({ employee, message: "Employee added successfully." });
  } catch (err) {
    next(err);
  }
};

export const employees = async (req, res, next) => {
  try {
    // Forward `status` / `search` query params so the list can be filtered.
    const rows = await Employee.employeeList(req.query);
    return res.status(200).json({ employees: rows });
  } catch (err) {
    next(err);
  }
};

export const overview = async (req, res, next) => {
  try {
    const stats = await Employee.employeeOverview();
    return res.status(200).json({ overview: stats });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = validate(updateEmployeeStatusSchema, req.body);

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");

    const employee = await Employee.updateEmployeeStatus({ id, status });
    if (!employee)
      throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");

    emitTransaction({
      action: "status",
      entity: "employee",
      actor: req.user,
      message: `Employee ${employee?.name ?? id} marked as ${status}.`,
      metadata: { userId: id, status },
      notifyUserIds: [id],
      adminOnly: false,
    });
    if (status !== "active") emitForceLogout(id, `Your account was marked as ${status}.`);

    return res
      .status(200)
      .json({ employee, message: `Employee marked as ${status}.` });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");

    // Issuance history must survive: an employee with any
    // `budget_issued_reference` row cannot be deleted (deactivate the account
    // instead) — otherwise the cascade would destroy their budget trail. The
    // menu already hides Delete for these accounts; this rejects direct calls.
    const issuedReferences = await Employee.countIssuedReferences(id);
    if (issuedReferences > 0)
      throw ApiError.conflict(
        "This employee has issued budget history and can't be deleted. Deactivate the account instead.",
        "EMPLOYEE_HAS_ISSUED_HISTORY",
      );

    const employee = await Employee.removeEmployee(id);
    if (!employee)
      throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");

    emitTransaction({
      action: "delete",
      entity: "employee",
      actor: req.user,
      message: `Removed employee ${employee?.name ?? id}.`,
      metadata: { userId: id },
      adminOnly: true,
    });
    emitForceLogout(id, "Your account was removed by an administrator.");

    return res
      .status(200)
      .json({ employee, message: "Employee removed successfully." });
  } catch (err) {
    next(err);
  }
};

// PATCH /employees/:id/avatar — admin replaces one employee's photo.
// Multipart `avatar` file with the same photo rules as the employee's own
// Account tab (uploadAvatar middleware). Any account status is fine: the
// route is admin-only and :id is re-validated against the users table.
export const updateAvatar = async (req, res, next) => {
  // Same orphan discipline as the Account save: the file is written first,
  // so track it and clean it up if anything after that fails.
  let uploadedAvatarUrl = null;
  let committed = false;

  try {
    const { employee } = await loadEmployee(req.params.id);

    if (!req.file) {
      throw ApiError.badRequest("No photo uploaded.", "NO_AVATAR_FILE");
    }

    uploadedAvatarUrl = await saveAvatarImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    const updated = await User.updateUserAvatar({
      id: employee.user_id,
      avatarUrl: uploadedAvatarUrl,
    });
    if (!updated) {
      throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");
    }

    // The previous photo is unreferenced now — remove it from disk only
    // after the new value is safely stored.
    if (employee.avatar_url && employee.avatar_url !== updated.avatar_url) {
      await deleteAvatarImage(employee.avatar_url);
    }

    committed = true;

    emitTransaction({
      action: "update",
      entity: "employee",
      actor: req.user,
      message: `Updated photo for employee ${updated?.name ?? employee.user_id}.`,
      metadata: { userId: employee.user_id },
      notifyUserIds: [employee.user_id],
      adminOnly: true,
    });

    return res.status(200).json({
      employee: updated,
      message: "Photo updated successfully.",
    });
  } catch (err) {
    if (uploadedAvatarUrl && !committed) {
      await deleteAvatarImage(uploadedAvatarUrl);
    }
    next(err);
  }
};

/* ── Admin → Employees → Details tabs ──────────────────────────────────────
 * Feeds the AdminEmployeesDetails page (`/admin/employees/:id`,
 * `/admin/employees/:id/overview`, `/admin/employees/:id/reimbursement` —
 * one shared element). The page URL's trailing section arrives as
 * `?view=reimbursement|overview` and DRIVES the scoping (see details*
 * below) — never the id shape alone:
 *   - `view=reimbursement` (`…/:birId/reimbursement`): `:id` IS the
 *     `budget_issued_reference.id`. Every child table (`issued_budget`,
 *     `expenses`, `employee_abono`, `budget_transfer`) carries
 *     `issued_ref_id → budget_issued_reference.id`, so all four detail
 *     payloads scope to that ONE record. A non-record id is a 404.
 *   - `view=overview` (`…/:userId/overview`, the default): `:id` IS the
 *     `users.user_id` and every leg is keyed on
 *     `budget_issued_reference.user_id` with
 *     `budget_issued_reference.status = 'open'` — closed holdings leave no
 *     footsteps in sums OR lists. A bir id still resolves through its
 *     holder (same open-only user scope); anything else is a 404.
 * Each handler resolves `:id` to a real `users` row first (ANY status — an
 * admin must be able to inspect pending and inactive accounts too), then
 * reuses the exact model call the employee-facing endpoint uses, only
 * swapping in the target user_id (+ optional issuedRefId / openOnly).
 * Read-only by design: nothing in this block can mutate the employee's rows,
 * and the employee id never comes from the caller's token.
 */
const loadEmployee = async (id, view) => {
  if (!UUID_RE.test(id || ""))
    throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");

  // Reimbursement view: the id is ALWAYS the issuance record id.
  if (view === "reimbursement") {
    const issuedRef = await Employee.findIssuedReferenceById(id);
    if (!issuedRef)
      throw ApiError.notFound(
        "Issuance record not found",
        "ISSUANCE_NOT_FOUND",
      );
    const owner = await Employee.findEmployeeById(issuedRef.user_id);
    if (!owner)
      throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");
    return { employee: owner, issuedRef, openOnly: false };
  }

  // Overview view: the id is the user id and everything keys on that user's
  // OPEN holdings only.
  const employee = await Employee.findEmployeeById(id);
  if (employee)
    return { employee, issuedRef: null, openOnly: view === "overview" };

  const issuedRef = await Employee.findIssuedReferenceById(id);
  if (!issuedRef)
    throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");
  const owner = await Employee.findEmployeeById(issuedRef.user_id);
  if (!owner)
    throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");

  if (!view) {
    // Legacy pre-view links: a bir id scopes to its record (historic
    // behaviour, kept so direct API callers never break).
    return { employee: owner, issuedRef, openOnly: false };
  }
  // Overview view: a bir id resolves through its holder but stays
  // user-scoped (open holdings only) — never record-scoped.
  return { employee: owner, issuedRef: null, openOnly: true };
};

// The page URL suffix arrives here as `?view=` (see employeesApi details*).
// Unknown/missing values keep the legacy id-shape behaviour so direct API
// callers never break.
const detailsView = (req) => {
  const view = req.query?.view;
  return view === "reimbursement" || view === "overview" ? view : null;
};

// GET /employees/by-issuance/:birId — holder + issuance record for one
// `budget_issued_reference` row id. Lets bir-id deep links render the holder's
// roster header while the tabs keep querying by the record id (scoped via
// `issued_ref_id`).
export const holderByIssuance = async (req, res, next) => {
  try {
    const { birId } = req.params;
    if (!UUID_RE.test(birId || ""))
      throw ApiError.badRequest(
        "Invalid issuance reference id",
        "VALIDATION_ERROR",
      );
    const [holder, issuedRef] = await Promise.all([
      Employee.findHolderByIssuedReferenceId(birId),
      Employee.findIssuedReferenceById(birId),
    ]);
    if (!holder || !issuedRef)
      throw ApiError.notFound(
        "Issuance record not found",
        "ISSUANCE_NOT_FOUND",
      );
    return res.status(200).json({ holder, issuedRef });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/overview — the employee's balance stats plus every
// merged transaction (issued / expense / abono / transfer), exactly the
// payload the employee's own Overview page renders.
// `?view=reimbursement`: `:id` is a `budget_issued_reference` row id and
// every leg scopes to that ONE issuance via `issued_ref_id`.
// `?view=overview`: `:id` is a user id and every leg keys on that user's
// OPEN holdings only (`budget_issued_reference.status = 'open'`).
// (see EmployeeOverview.employeeOverview).
export const detailsOverview = async (req, res, next) => {
  try {
    const view = detailsView(req);
    const { employee, issuedRef, openOnly } = await loadEmployee(
      req.params.id,
      view,
    );
    const employeeOverview = await EmployeeOverview.employeeOverview(
      employee.user_id,
      {
        search: req.query?.search,
        issuedRefId: issuedRef?.id ?? null,
        openOnly: openOnly ?? false,
      },
    );
    return res.status(200).json({
      employeeOverview,
      // Echo the issuance record so the page can label a record-scoped view
      // without a second round-trip (null on plain user-id links).
      issuedRef: issuedRef ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/budget — every issuance + transfer the employee holds,
// with the balance overview (same payload as GET /budgets/employee).
// `?view=reimbursement` scopes to that ONE issuance via `issued_ref_id`;
// `?view=overview` keys on the user's OPEN holdings only.
export const detailsBudget = async (req, res, next) => {
  try {
    const view = detailsView(req);
    const { employee, issuedRef, openOnly } = await loadEmployee(
      req.params.id,
      view,
    );
    const { overview, transactions } = await Budget.employeeBudget(
      employee.user_id,
      {
        search: req.query?.search,
        issuedRefId: issuedRef?.id ?? null,
        openOnly: openOnly ?? false,
      },
    );
    return res.status(200).json({
      overview,
      transactions,
      issuedRef: issuedRef ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/expenses — the employee's expense ledger, categories,
// source references and totals (same payload as GET /expenses/employee).
// `?view=reimbursement` lists only expenses stamped with that issuance
// record; `?view=overview` lists only expenses under the user's OPEN holdings.
export const detailsExpenses = async (req, res, next) => {
  try {
    const view = detailsView(req);
    const { employee, issuedRef, openOnly } = await loadEmployee(
      req.params.id,
      view,
    );
    const {
      categories,
      expenses: rows,
      overview,
      references,
    } = await Expenses.expensesOverviewEmployee(
      req.query,
      employee.user_id,
      { issuedRefId: issuedRef?.id ?? null, openOnly: openOnly ?? false },
    );
    return res.status(200).json({
      expenses: rows,
      categories,
      overview,
      references,
      issuedRef: issuedRef ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/abono — the employee's abono rows plus the overview the
// Abono page's hero/mini stats render (same payload as GET /abono/employee).
// `?view=reimbursement` lists only abono stamped with that issuance record;
// `?view=overview` lists only abono under the user's OPEN holdings.
export const detailsAbono = async (req, res, next) => {
  try {
    const view = detailsView(req);
    const { employee, issuedRef, openOnly } = await loadEmployee(
      req.params.id,
      view,
    );
    const { abono: rows, overview } = await Abono.employeeAbonoOverview(
      employee.user_id,
      { issuedRefId: issuedRef?.id ?? null, openOnly: openOnly ?? false },
    );
    return res.status(200).json({
      abono: rows,
      overview,
      issuedRef: issuedRef ?? null,
    });
  } catch (err) {
    next(err);
  }
};
