import EmployeeReimbursement from "../models/employee-reimbursement.model.js";

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
