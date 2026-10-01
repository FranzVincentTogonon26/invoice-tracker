import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeSettingsApi } from "../api/employee-settings";

// The signed-in employee's own account row (`{ user }` from the users table),
// re-read through the API so the Setting page always renders stored values.
export const employeeSettingsKey = () => ["employeeSettings"];

export function useEmployeeSettings() {
  const query = useQuery({
    queryKey: employeeSettingsKey(),
    queryFn: () => employeeSettingsApi.account(),
  });

  return {
    ...query,
    user: query.data?.user ?? null,
  };
}

// Account / password mutations. Both surface backend ApiErrors unchanged so
// the forms can show the server's message (wrong current password, email
// already taken, inactive account, …).
export function useEmployeeSettingsMutations() {
  const qc = useQueryClient();

  // A saved account row is also mirrored in other views (the admin Employees
  // list renders avatar/name, the budget-transfer picker shows the avatar), so
  // those caches are invalidated alongside the settings key.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employeeSettings"] });
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["budgetTransfer"] });
  };

  return {
    // `updateAccount({ name, email, avatarFile, removeAvatar })` — multipart
    // save; the photo uploads in this same request.
    updateAccount: useMutation({
      mutationFn: employeeSettingsApi.updateAccount,
      onSuccess: invalidate,
    }),
    // `updatePassword({ currentPassword, newPassword })` — the caller logs out
    // afterwards (fresh session with the new credential), so nothing is
    // cached here.
    updatePassword: useMutation({
      mutationFn: employeeSettingsApi.updatePassword,
    }),
  };
}

