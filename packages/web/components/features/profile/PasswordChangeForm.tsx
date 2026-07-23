"use client";

import { useState } from "react";
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
}

export function PasswordChangeForm({ onSuccess, onCancel, compact, hasPassword: initialHasPassword }: PasswordChangeFormProps) {
  const { t } = useI18n();
  const [hasPassword] = useState(initialHasPassword ?? true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (newPassword !== confirmPassword) {
      setFormError(t.profile.passwordsMismatch);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api("/user/password", { method: "PUT", body: { currentPassword, newPassword } });
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

  const canSubmit = newPassword && confirmPassword && (!hasPassword || currentPassword);
  const submitLabel = hasPassword ? t.profile.updatePassword : t.profile.setPassword;

  return (
    <form onSubmit={handleSubmit} className="password-form">
      {hasPassword && (
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
    </form>
  );
}
