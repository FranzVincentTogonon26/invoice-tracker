import User from "../models/user.model.js";
import jwtToken from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("authorization")?.startsWith("Bearer ")
      ? req.header("authorization").split(" ")[1]
      : null;

    if (!token) {
      throw ApiError.unauthorized("No token provided");
    }

    const decoded = jwtToken.verify(token);

    const user = await User.findUserById(decoded.user_id);
    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    if (user.status !== "active") {
      throw ApiError.forbidden(
        "Your account is not active. Please contact an administrator.",
        "ACCOUNT_NOT_ACTIVE",
      );
    }

    req.user = {
      id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      // Kept so role guards downstream (employee routes) can re-verify the
      // account is still active without a second users-table round trip.
      status: user.status,
    };

    // Device clock for the audit trail (`X-Client-At` = device epoch ms,
    // `X-Client-Tz` = minutes ahead of UTC). Validated and skew-guarded
    // here so the transaction logger can record the wall time the user
    // actually saw on their device. Missing/garbage/skewed values fall back
    // to the server clock downstream.
    try {
      const at = Number(req.header("x-client-at"));
      const tz = Number.parseInt(req.header("x-client-tz"), 10);
      if (
        Number.isFinite(at) &&
        Math.abs(at - Date.now()) <= 24 * 60 * 60 * 1000 &&
        Number.isFinite(tz) &&
        tz >= -720 &&
        tz <= 840
      ) {
        req.user.clientAt = at;
        req.user.clientTz = tz;
      }
    } catch {
      // best-effort: a bad clock header must never break auth
    }
    next();
  } catch (err) {
    if (err.isApiError) return next(err);
    next(ApiError.unauthorized("Invalid token"));
  }
};

export default authMiddleware;
