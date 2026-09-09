import ApiError from "../utils/ApiError.js";

// Requires a valid token (authMiddleware runs first) and an admin role.
const requireAdminAccess = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized("Authentication required"));
  }

  if (req.user.role !== "admin") {
    return next(ApiError.forbidden("Admin access required"));
  }

  next();
};

export default requireAdminAccess;
