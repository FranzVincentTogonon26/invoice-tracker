import Employee from "../models/employee.model.js";
import User from "../models/user.model.js";
import EmployeeOverview from "../models/employee.overview.model.js";
import Budget from "../models/budget.model.js";
import Expenses from "../models/expenses.model.js";
import Abono from "../models/abono.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
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
    const employee = await loadEmployee(req.params.id);

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
 * Feeds /admin/employees/:id with ONE selected employee's records. Each
 * handler resolves `:id` to a real `users` row first (ANY status — an admin
 * must be able to inspect pending and inactive accounts too), then reuses the
 * exact model call the employee-facing endpoint uses, only swapping in the
 * target user_id. Read-only by design: nothing in this block can mutate the
 * employee's rows, and the employee id never comes from the caller's token.
 */
const loadEmployee = async (id) => {
  if (!UUID_RE.test(id || ""))
    throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");

  const employee = await Employee.findEmployeeById(id);
  if (!employee)
    throw ApiError.notFound("Employee not found", "EMPLOYEE_NOT_FOUND");

  return employee;
};

// GET /employees/:id/overview — the employee's balance stats plus every
// merged transaction (issued / expense / abono / transfer), exactly the
// payload the employee's own Overview page renders.
export const detailsOverview = async (req, res, next) => {
  try {
    const employee = await loadEmployee(req.params.id);
    const employeeOverview = await EmployeeOverview.employeeOverview(
      employee.user_id,
      req.query,
    );
    return res.status(200).json({ employeeOverview });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/budget — every issuance + transfer the employee holds,
// with the balance overview (same payload as GET /budgets/employee).
export const detailsBudget = async (req, res, next) => {
  try {
    const employee = await loadEmployee(req.params.id);
    const { overview, transactions } = await Budget.employeeBudget(
      employee.user_id,
      req.query,
    );
    return res.status(200).json({ overview, transactions });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/expenses — the employee's expense ledger, categories,
// source references and totals (same payload as GET /expenses/employee).
export const detailsExpenses = async (req, res, next) => {
  try {
    const employee = await loadEmployee(req.params.id);
    const {
      categories,
      expenses: rows,
      overview,
      references,
    } = await Expenses.expensesOverviewEmployee(req.query, employee.user_id);
    return res
      .status(200)
      .json({ expenses: rows, categories, overview, references });
  } catch (err) {
    next(err);
  }
};

// GET /employees/:id/abono — the employee's abono rows plus the overview the
// Abono page's hero/mini stats render (same payload as GET /abono/employee).
export const detailsAbono = async (req, res, next) => {
  try {
    const employee = await loadEmployee(req.params.id);
    const { abono: rows, overview } = await Abono.employeeAbonoOverview(
      employee.user_id,
    );
    return res.status(200).json({ abono: rows, overview });
  } catch (err) {
    next(err);
  }
};
