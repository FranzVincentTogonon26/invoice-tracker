import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const jwtToken = {
  // Session tokens use ENV.JWT_EXPIRES; purpose-scoped tokens (e.g. the
  // password-reset proof) pass a shorter `expiresIn` override so a reset
  // credential can't outlive its flow.
  sign: (payload, options = {}) => {
    try {
      return jwt.sign(payload, ENV.JWT_SECRET, {
        expiresIn: ENV.JWT_EXPIRES,
        ...options,
      });
    } catch (error) {
      throw ApiError.internal("Error generating JWT token");
    }
  },

  verify: (token) => {
    try {
      return jwt.verify(token, ENV.JWT_SECRET);
    } catch (error) {
      throw ApiError.unauthorized("Invalid JWT token");
    }
  },
};

export default jwtToken;