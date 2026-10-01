import bcrypt from "bcryptjs";

import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { deleteAvatarImage, saveAvatarImage } from "../utils/avatarImage.js";
import {
  updateAccountSchema,
  updatePasswordSchema,
} from "../validations/employee.settings.validation.js";

// Employee Setting endpoints — everything here reads and writes the caller's
// own row in the `users` table (the same table login/registration use).
//
// Every handler re-reads the caller BEFORE changing any credential: the
// account must still EXIST and carry status = 'active'. authMiddleware checks
// the token first, but this endpoint is the only place a user edits their own
// credentials, so the validation is repeated explicitly right before the write
// instead of trusting an earlier middleware pass.
const loadActiveUser = async (req) => {
  const user = await User.findUserById(req.user.id);

  if (!user) {
    throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
  }

  if (user.status !== "active") {
    throw ApiError.forbidden(
      "Your account is not active. Please contact an administrator.",
      "ACCOUNT_NOT_ACTIVE",
    );
  }

  return user;
};

// GET /api/employee_settings/account — the signed-in employee's own account
// row (safe columns only; the password hash is never selected).
export const account = async (req, res, next) => {
  try {
    const user = await loadActiveUser(req);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// PUT /api/employee_settings/account
// Multipart save of the Account tab: `name`, `email`, an optional `avatar`
// photo, and an optional `remove_avatar` flag. The photo is written to
// `backend/uploads/avatars` ONLY when this save is applied, and the row is
// updated only after the current user was re-validated.
export const updateAccount = async (req, res, next) => {
  // The users row stores the avatar's final URL, so the file has to be
  // written first. Track it and clean it up if anything after that fails — a
  // failed save must never leave an orphaned file behind.
  let uploadedAvatarUrl = null;
  let committed = false;

  try {
    const { name, email } = validate(updateAccountSchema, req.body);
    const removeAvatar = String(req.body?.remove_avatar ?? "") === "true";

    const user = await loadActiveUser(req);

    const nextName = name.trim();
    const nextEmail = email.trim();

    // users.email is UNIQUE — changing it must not collide with another
    // account (the model excludes the caller's own row from the check).
    if (nextEmail !== user.email) {
      const taken = await User.findUserByEmailExceptId(nextEmail, user.user_id);
      if (taken) {
        throw ApiError.conflict(
          "An account with this email already exists.",
          "EMAIL_ALREADY_EXISTS",
        );
      }
    }

    if (req.file) {
      uploadedAvatarUrl = await saveAvatarImage({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });
    }

    // A newly saved photo wins over "remove"; otherwise removing clears the
    // column and an untouched avatar keeps its stored URL.
    const avatarUrl =
      uploadedAvatarUrl ?? (removeAvatar ? null : user.avatar_url);

    const updated = await User.updateUserAccount({
      id: user.user_id,
      name: nextName,
      email: nextEmail,
      avatarUrl,
    });

    // null = the guarded UPDATE matched nothing (the account stopped being
    // active between the check above and the write).
    if (!updated) {
      throw ApiError.forbidden(
        "Your account is not active. Please contact an administrator.",
        "ACCOUNT_NOT_ACTIVE",
      );
    }

    // The previous photo is unreferenced now — remove it from disk only after
    // the new value is safely stored, so a failed update can never destroy the
    // avatar that is still in use.
    if (user.avatar_url && user.avatar_url !== updated.avatar_url) {
      await deleteAvatarImage(user.avatar_url);
    }

    committed = true;

    return res.status(200).json({
      user: updated,
      message: "Account updated successfully.",
    });
  } catch (err) {
    if (uploadedAvatarUrl && !committed) {
      await deleteAvatarImage(uploadedAvatarUrl);
    }
    next(err);
  }
};


// PUT /api/employee_settings/password
// { current_password, new_password } — verifies the current credential with
// the existing bcrypt procedure, then stores the new one hashed exactly the
// way registration/login expect it (User.updateUserPassword hashes with the
// same SALT_ROUNDS as User.createUser).
export const updatePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = validate(
      updatePasswordSchema,
      req.body,
    );

    // Exists + active before the credential is inspected or written.
    const user = await loadActiveUser(req);

    const record = await User.findUserWithPasswordById(user.user_id);
    if (!record?.password) {
      throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
    }

    const currentMatches = await bcrypt.compare(
      current_password,
      record.password,
    );
    if (!currentMatches) {
      throw ApiError.badRequest(
        "Your current password is incorrect.",
        "PASSWORD_MISMATCH",
      );
    }

    // A "change" to the same secret would still end the session, so ask for a
    // genuinely new password instead.
    if (await bcrypt.compare(new_password, record.password)) {
      throw ApiError.badRequest(
        "Your new password must be different from the current one.",
        "PASSWORD_UNCHANGED",
      );
    }

    const updated = await User.updateUserPassword({
      id: user.user_id,
      password: new_password,
    });

    if (!updated) {
      throw ApiError.forbidden(
        "Your account is not active. Please contact an administrator.",
        "ACCOUNT_NOT_ACTIVE",
      );
    }

    // No token is returned on purpose — the client signs out and starts a
    // fresh session with the new credential.
    return res.status(200).json({
      user: updated,
      message: "Password updated successfully. Please sign in again.",
    });
  } catch (err) {
    next(err);
  }
};

