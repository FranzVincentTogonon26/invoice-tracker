import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
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
