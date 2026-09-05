import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const jwtToken = {
  sign: (payload) => {
    try {
      return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES });
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