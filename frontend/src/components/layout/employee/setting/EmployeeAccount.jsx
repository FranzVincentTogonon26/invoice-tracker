import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleUser,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "../../../ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../ui/Card";
import { Input } from "../../../ui/Input";
import ConfirmActionDialog from "../../admin/expenses/ConfirmActionDialog";
import { useAuth } from "@/context/AuthContext";
import { useEmployeeSettingsMutations } from "@/hooks/useEmployeeSettings";
import {
  AVATAR_ACCEPT,
  AVATAR_EXTENSIONS,
  AVATAR_UPLOAD_HINT,
} from "@/constants";
import { cn, fileExtension } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FieldLabel = ({ children }) => (
  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
    {children}
  </p>
);

// One line of the confirmation summary — changed rows read bold so the final
// gate shows exactly what the save is about to write.
const SummaryRow = ({ label, value, changed }) => (
  <div className="flex items-center justify-between gap-3">
    <p className="shrink-0 text-sm text-[var(--ink-muted)]">{label}</p>
    <p
      className={cn(
        "min-w-0 truncate text-sm",
        changed ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]",
      )}
    >
      {value}
    </p>
  </div>
);

const EmployeeAccount = ({ user, loading = false }) => {
  const fileRef = useRef(null);
  // Session user (`/auth/me`, already in memory from sign-in) seeds the
  // fields instantly; the settings row (`GET /employee_settings/account`)
  // overrides it when it lands. Either source alone is enough to display the
  // current information — the form never sits empty waiting on one fetch.
  const { user: sessionUser, refresh } = useAuth();
  const { updateAccount } = useEmployeeSettingsMutations();
  const saving = updateAccount.isPending;

  const [form, setForm] = useState(() => ({
    // Seed from the current information on first render — the sync block
    // below only re-seeds when the stored row CHANGES, so without this the
    // fields would sit empty whenever the user was already loaded at mount.
    name: user?.name ?? sessionUser?.name ?? "",
    email: user?.email ?? sessionUser?.email ?? "",
  }));
  const [file, setFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const storedName = user?.name ?? sessionUser?.name ?? "";
  const storedEmail = user?.email ?? sessionUser?.email ?? "";
  const rawStoredAvatar = user?.avatar_url ?? sessionUser?.avatar_url ?? "";
  const storedAvatar =
    typeof rawStoredAvatar === "string"
      ? rawStoredAvatar.trim()
      : rawStoredAvatar || "";

  // Editable as soon as EITHER source has the row — the settings fetch only
  // blocks the form while nothing has loaded yet.
  const waiting = loading && !user && !sessionUser;

  // Hydrate the form from the stored `users` row. Adjusting state DURING
  // render (the documented alternative to a setState-in-effect, already used
  // by the shells) re-seeds the fields whenever the stored values change —
  // including the post-save refresh — without wiping the user's typing on a
  // refetch that returns the same row.
  const storedSignature = `${storedName}\u0000${storedEmail}\u0000${storedAvatar}`;
  const [hydratedFor, setHydratedFor] = useState(storedSignature);
  if (hydratedFor !== storedSignature) {
    setHydratedFor(storedSignature);
    setForm({ name: storedName, email: storedEmail });
    setFile(null);
    setRemoveAvatar(false);
    setAvatarBroken(false);
    setErrors({});
  }

  // Object-URL preview of a freshly picked photo; revoked as soon as the pick
  // changes or the panel unmounts (the file itself stays in memory only).
  const localPreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  // Precedence: the newly picked photo, then the stored avatar — unless the
  // user asked for the stored photo to be removed on save.
  const avatarSrc = localPreview || (removeAvatar ? "" : storedAvatar);

  const set = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onAvatarPick = (event) => {
    const picked = event.target.files?.[0];
    // Reset the input so re-picking the SAME file still fires onChange.
    event.target.value = "";
    if (!picked) return;

    // Photos only. There is deliberately NO size check: any photo size is
    // accepted (the backend enforces the same extension list without a byte
    // cap), so a 40MB phone photo is just as valid as a small one.
    if (!AVATAR_EXTENSIONS.includes(fileExtension(picked.name))) {
      setErrors((prev) => ({
        ...prev,
        avatar: "Photos only — PNG, JPG, JPEG, WEBP, HEIC or HEIF.",
      }));
      return;
    }

    setFile(picked);
    setRemoveAvatar(false);
    setAvatarBroken(false);
    setErrors((prev) => {
      if (!prev.avatar) return prev;
      const next = { ...prev };
      delete next.avatar;
      return next;
    });
  };

  // Discards a freshly picked photo first; a second press marks the stored
  // avatar for removal when the save runs.
  const removePhoto = () => {
    if (file) {
      setFile(null);
      setAvatarBroken(false);
      return;
    }
    setRemoveAvatar(true);
    setAvatarBroken(false);
    setErrors((prev) => {
      if (!prev.avatar) return prev;
      const next = { ...prev };
      delete next.avatar;
      return next;
    });
  };

  // Fields are re-checked client-side before the confirmation modal opens, so
  // the final gate is never reached with an invalid form.
  const validate = () => {
    const next = {};

    const name = form.name.trim();
    if (!name) next.name = "Name is required.";
    else if (name.length < 2) next.name = "Name must be at least 2 characters.";

    const email = form.email.trim();
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";

    setErrors((prev) => {
      const merged = { ...next };
      // The photo error comes from the picker, not this validator — keep it.
      if (prev.avatar) merged.avatar = prev.avatar;
      return merged;
    });

    return Object.keys(next).length === 0;
  };

  const nameChanged = form.name.trim() !== storedName;
  const emailChanged = form.email.trim() !== storedEmail;
  const avatarChanged = Boolean(file) || (removeAvatar && Boolean(storedAvatar));
  const dirty = nameChanged || emailChanged || avatarChanged;

  // Step 1 — Save only validates; nothing is written yet.
  const handleSaveClick = (event) => {
    event.preventDefault();
    if (saving || waiting || !dirty) return;
    if (!validate()) return;
    setConfirmOpen(true);
  };

  // Step 2 — the confirmation modal's confirm: the only place the request
  // (and the photo upload with it) actually runs.
  const handleConfirmSave = async () => {
    if (saving || !validate()) {
      setConfirmOpen(false);
      return;
    }

    try {
      await updateAccount.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        avatarFile: file,
        removeAvatar: removeAvatar && Boolean(storedAvatar),
      });

      // Account info only → refresh the session so the saved name/photo render
      // everywhere (topbar, sidebar, pickers) without a page reload.
      await refresh();

      toast.success("Account updated successfully");
      setConfirmOpen(false);
      setFile(null);
      setRemoveAvatar(false);
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err?.message || "Couldn't update your account");
    }
  };

  const photoSummary = file
    ? `New photo — ${file.name}`
    : removeAvatar && storedAvatar
      ? "Remove current photo"
      : storedAvatar
        ? "Keep current photo"
        : "None";

  const confirmSummary = (
    <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <SummaryRow label="Name" value={form.name.trim()} changed={nameChanged} />
      <SummaryRow
        label="Email"
        value={form.email.trim()}
        changed={emailChanged}
      />
      <SummaryRow label="Photo" value={photoSummary} changed={avatarChanged} />
    </div>
  );

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle className="text-base">My profile</CardTitle>
          <CardDescription className="mt-1">
            Manage your account information. A new photo is uploaded only when
            you save your changes.
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSaveClick} className="max-w-2xl space-y-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
            {avatarSrc && !avatarBroken ? (
              <img
                src={avatarSrc}
                alt="Profile photo"
                className="h-full w-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <CircleUser size={22} className="text-[var(--ink-muted)]" />
            )}
          </div>

          <div className="min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={onAvatarPick}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || waiting}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={14} aria-hidden />
                {avatarSrc ? "Change photo" : "Upload photo"}
              </Button>

              {file || (storedAvatar && !removeAvatar) ? (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={saving || waiting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:opacity-80 disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden />
                  {file ? "Discard photo" : "Remove"}
                </button>
              ) : null}

              {removeAvatar && storedAvatar ? (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveAvatar(false);
                    setAvatarBroken(false);
                  }}
                  disabled={saving || waiting}
                  className="text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-50"
                >
                  Undo
                </button>
              ) : null}
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-[var(--ink-muted)]">
              {AVATAR_UPLOAD_HINT} Saved with your changes.
            </p>
          </div>
        </div>

        {errors.avatar && (
          <p
            role="alert"
            className="-mt-3 text-xs font-medium text-[var(--danger)]"
          >
            {errors.avatar}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <FieldLabel>Full name</FieldLabel>
            <Input
              value={form.name}
              onChange={set("name")}
              placeholder="Your full name"
              autoComplete="name"
              disabled={saving || waiting}
              aria-invalid={Boolean(errors.name) || undefined}
            />
            {errors.name && (
              <p
                role="alert"
                className="mt-1.5 text-[11px] font-medium text-[var(--danger)]"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="your@email.com"
              autoComplete="email"
              disabled={saving || waiting}
              aria-invalid={Boolean(errors.email) || undefined}
            />
            {errors.email && (
              <p
                role="alert"
                className="mt-1.5 text-[11px] font-medium text-[var(--danger)]"
              >
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <p className="mr-auto text-[11px] text-[var(--ink-muted)]">
            {waiting
              ? "Loading your account…"
              : dirty
                ? "Unsaved changes"
                : "All changes saved"}
          </p>
          <Button
            type="submit"
            variant="accent"
            disabled={saving || waiting || !dirty}
          >
            {saving && (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            )}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Final gate — the request (and the photo upload with it) only runs from
          here, after the validated summary above was confirmed. */}
      <ConfirmActionDialog
        open={confirmOpen}
        icon={<ShieldCheck size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Save account changes?"
        description="This updates your account record in the users database."
        summary={confirmSummary}
        cancelLabel="Go back"
        confirmLabel="Yes, save changes"
        confirmVariant="accent"
        pendingLabel="Saving…"
        pending={saving}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmSave}
      />
    </Card>
  );
};

export default EmployeeAccount;

