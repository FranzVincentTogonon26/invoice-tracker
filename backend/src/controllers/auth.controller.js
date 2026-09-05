import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import jwtToken from "../utils/jwt.js";
import { validate } from "../utils/validate.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";

// Strips sensitive fields before a user object is returned to clients
const sanitize = ({ password, ...safe }) => safe;

const ensureUserCanLogin = (user) => {
  if (user.status === "active") return;

  if (user.status === "pending") {
    throw ApiError.forbidden(
      "Your account is awaiting administrator approval.",
      "ACCOUNT_PENDING",
    );
  }

  throw ApiError.forbidden(
    "Your account is inactive. Please contact an administrator.",
    "ACCOUNT_INACTIVE",
  );
};

const buildAuthResponse = (user) => {
  const token = jwtToken.sign({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { user: sanitize(user), token };
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body);

    const user = await User.findUserByEmail(email);

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    ensureUserCanLogin(user);

    return res.json({
      message: "Signed in successfully.",
      ...buildAuthResponse(user),
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = validate(registerSchema, req.body);

    const existingUser = await User.findUserByEmail(email);

    if (existingUser) {
      throw ApiError.conflict("User with this email already exists.");
    }

    const user = await User.createUser({
      name,
      email,
      password,
    });

    if (user.status.toLowerCase() !== "active") {
      return res.status(201).json({
        message:
          "Your account has been created and is awaiting administrator approval.",
      });
    }

    return res.status(201).json({
      message: "Account created successfully.",
      ...buildAuthResponse(user),
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findUserById(req.user.id);

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    ensureUserCanLogin(user);

    return res.json({ user });
  } catch (err) {
    next(err);
  }
};
