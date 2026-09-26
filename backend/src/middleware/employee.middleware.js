import ApiError from "../utils/ApiError.js";

// Employee-only routes (authMiddleware runs first, so `req.user` is a real,
// still-existing users row). Requires BOTH:
//   - role  = "employee"  → an admin/other token can never read the employee
//     ledger or its overview through the employee endpoints (no impersonating
//     a wider scope than the signed-in account holds), and
//   - status = "active"   → a suspended/disabled account is cut off even if
//     the token itself is still valid.
// The response carries `EMPLOYEE_ACCESS_REQUIRED` so the API client knows to
// drop the token and send the user back to /login instead of retrying.
const requireEmployeeAccess = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Authentication required"));
  }

  if (req.user.role !== "employee" || req.user.status !== "active") {
    return next(
      ApiError.forbidden(
        "Employee access required. Please sign in again.",
        "EMPLOYEE_ACCESS_REQUIRED",
      ),
    );
  }

  next();
};

export default requireEmployeeAccess;
