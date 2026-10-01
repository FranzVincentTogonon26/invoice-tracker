import { apiClient } from "./client";

export const employeeSettingsApi = {
  // The signed-in employee's own account row — fresh from the users table.
  account: () => apiClient.get("/employee_settings/account").then((r) => r.data),

  // Saves the Account tab in ONE multipart request: the field values plus
  // (when a photo was picked) the file itself. The server writes the photo to
  // `uploads/avatars` only when this request is applied and succeeds — a
  // picked-but-unsaved photo never reaches the backend.
  // `removeAvatar` clears the stored photo instead of replacing it.
  updateAccount: ({ name, email, avatarFile = null, removeAvatar = false }) => {
    const form = new FormData();
    form.append("name", name);
    form.append("email", email);
    if (removeAvatar) form.append("remove_avatar", "true");
    if (avatarFile) form.append("avatar", avatarFile);

    return apiClient
      .put("/employee_settings/account", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // Changes the account password. { current_password, new_password } — the
  // server verifies the current one and stores the new one hashed. The caller
  // must sign out afterwards so the next login starts a fresh session.
  updatePassword: ({ currentPassword, newPassword }) =>
    apiClient
      .put("/employee_settings/password", {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((r) => r.data),
};

