"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field } from "@/components";
import { apiFetch } from "@/lib/api";
import styles from "./profile.module.css";

export interface ProfileFormProps {
  email: string;
}

export function ProfileForm({ email: initialEmail }: ProfileFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const trimmedEmail = email.trim().toLowerCase();
    const emailChanged = trimmedEmail !== initialEmail;

    if (!currentPassword) {
      setError("Enter your current password to make any change.");
      return;
    }

    if (!emailChanged && !newPassword) {
      setError("Change the email or set a new password first.");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          email: emailChanged ? trimmedEmail : undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Could not update your profile (${response.status}).`;
        throw new Error(message);
      }

      setStatus(
        newPassword
          ? "Profile updated. Your other sessions were signed out."
          : "Profile updated.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Field
        id="profile-email"
        type="email"
        label="Email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div className={styles.divider} />

      <Field
        id="profile-new-password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="Leave blank to keep your current password."
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Field
        id="profile-confirm-password"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <div className={styles.divider} />

      <Field
        id="profile-current-password"
        type="password"
        label="Current password"
        autoComplete="current-password"
        hint="Required to save any change above."
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />

      {(error || status) && (
        <p
          className={[styles.status, error ? styles.statusError : null]
            .filter(Boolean)
            .join(" ")}
          role={error ? "alert" : "status"}
        >
          {error ?? status}
        </p>
      )}

      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export default ProfileForm;
