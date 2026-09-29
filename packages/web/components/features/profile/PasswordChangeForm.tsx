"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

interface PasswordChangeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  compact?: boolean;
  hasPassword?: boolean;
  resetMode?: boolean;
}

export const PASSWORD_RESET_TICKET_KEY = "neo_id_password_reset_ticket";

type MfaMethod = "totp" | "email" | "passkey";

export function PasswordChangeForm({ onSuccess, onCancel, compact, hasPassword: initialHasPassword, resetMode = false }: PasswordChangeFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [hasPassword] = useState(initialHasPassword ?? true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const requestMfaReset = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await api<{ mfaRequired: boolean; mfaMethods: MfaMethod[]; emailHint?: string }>(
        "/user/password/reset",
        { method: "POST" }
      );
      if (res.mfaRequired) {
        const params = new URLSearchParams({
          purpose: "password-reset",
          methods: (res.mfaMethods || []).join(","),
        });
        if (res.emailHint) params.set("emailHint", res.emailHint);
        router.push(`/auth/2fa?${params.toString()}`);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.error;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (newPassword !== confirmPassword) {
      setFormError(t.profile.passwordsMismatch);
      return;
    }
    if (resetMode) {
      if (!newPassword || newPassword.length < 8) {
        setFormError(t.auth.resetPassword.passwordTooShort);
        return;
      }
      let resetTicket: string | null = null;
      try {
        resetTicket = sessionStorage.getItem(PASSWORD_RESET_TICKET_KEY);
      } catch {
        resetTicket = null;
      }
      if (!resetTicket) {
        setFormError(t.common.error);
        return;
      }
      setSaving(true);
      setFormError(null);
      try {
        await api("/user/password/reset/confirm", {
          method: "POST",
          body: { resetTicket, newPassword },
        });
        try {
          sessionStorage.removeItem(PASSWORD_RESET_TICKET_KEY);
        } catch {
          // ignore
        }
        setNewPassword("");
        setConfirmPassword("");
        toast.success(t.profile.resetPasswordSuccess);
        onSuccess?.();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : t.common.error;
        setFormError(msg);
        toast.error(msg);
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api("/user/password", {
        method: "PUT",
        body: hasPassword ? { currentPassword, newPassword } : { newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t.common.success);
      onSuccess?.();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.error;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = resetMode
    ? newPassword && confirmPassword
    : newPassword && confirmPassword && (!hasPassword || currentPassword);
  const submitLabel = resetMode
    ? t.profile.resetPassword
    : hasPassword ? t.profile.updatePassword : t.profile.setPassword;

  return (
    <form onSubmit={handleSubmit} className="password-form">
      {hasPassword && !resetMode && (
        <Input
          label={t.profile.currentPassword}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t.auth.passwordPlaceholder}
          autoComplete="current-password"
          required
        />
      )}

      <div className="password-form__group">
        <Input
          label={t.profile.newPassword}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t.auth.passwordPlaceholder}
          autoComplete="new-password"
          required
        />
        <Input
          label={t.profile.confirmPassword}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t.auth.passwordPlaceholder}
          autoComplete="new-password"
          required
        />
      </div>

      {formError && <div className="alert alert--error">{formError}</div>}

      <div className={compact ? "password-form__actions password-form__actions--stacked" : "password-form__actions"}>
        {!compact && onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel} disabled={saving}>
            {t.common.cancel}
          </Button>
        )}
        <Button
          type="submit"
          loading={saving}
          disabled={!canSubmit}
          className={compact ? "password-form__submit" : undefined}
        >
          {submitLabel}
        </Button>
      </div>

      {hasPassword && !resetMode && (
        <button
          type="button"
          className="password-form__forgot-link"
          onClick={() => requestMfaReset()}
          disabled={saving}
        >
          {t.profile.resetPasswordButton}
        </button>
      )}
    </form>
  );
}
