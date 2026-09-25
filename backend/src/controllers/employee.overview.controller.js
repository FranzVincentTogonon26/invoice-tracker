import ApiError from "../utils/ApiError.js";
import EmployeeOverview from "../models/employee.overview.model.js";
import User from "../models/user.model.js";

export const employeeOverview = async (req, res, next) => {
  try {
    // `req.user.id` comes from the auth middleware (JWT) — the overview is
    // always scoped to the logged-in employee's own user_id.
    const user = await User.findUserById(req.user.id);

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    const employeeOverview = await EmployeeOverview.employeeOverview(
      user.user_id,
      req.query,
    );

    return res.status(200).json({
      employeeOverview,
    });
  } catch (err) {
    next(err);
  }
};
