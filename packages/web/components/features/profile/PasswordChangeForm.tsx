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

type MfaMethod = "totp" | "email" | "passkey";

export function PasswordChangeForm({ onSuccess, onCancel, compact, hasPassword: initialHasPassword }: PasswordChangeFormProps) {
  const { t } = useI18n();
  const [hasPassword] = useState(initialHasPassword ?? true);

  const [mode, setMode] = useState<"change" | "mfa-select" | "mfa-verify">("change");
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[]>([]);
  const [emailHint, setEmailHint] = useState<string | undefined>();
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const requestMfaReset = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await api<{ mfa_required: boolean; mfa_methods: MfaMethod[]; email_hint?: string }>(
        "/user/password/reset",
        { method: "POST" }
      );
      if (res.mfa_required) {
        setMfaMethods(res.mfa_methods);
        setEmailHint(res.email_hint);
        setMode("mfa-select");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.common.error;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!selectedMethod) return;
    if (newPassword !== confirmPassword) {
      setFormError(t.profile.passwordsMismatch);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api("/user/password/reset/verify", {
        method: "POST",
        body: {
          method: selectedMethod,
          code: mfaCode || undefined,
          newPassword,
        },
      });
      toast.success(t.profile.resetPasswordSuccess);
      onSuccess?.();
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

  if (mode === "mfa-select") {
    return (
      <div className="password-form password-form--mfa">
        <p className="password-form__mfa-title">{t.profile.resetPasswordMfaRequired}</p>
        <p className="password-form__mfa-subtitle">{t.profile.resetPasswordMfaSubtitle}</p>

        <div className="password-form__mfa-methods">
          {mfaMethods.includes("totp") && (
            <button
              type="button"
              className="password-form__mfa-btn"
              onClick={() => { setSelectedMethod("totp"); setMode("mfa-verify"); }}
            >
              <span className="password-form__mfa-icon">&#128272;</span>
              <span>{t.auth.mfa.totp}</span>
            </button>
          )}
          {mfaMethods.includes("email") && (
            <button
              type="button"
              className="password-form__mfa-btn"
              onClick={() => { setSelectedMethod("email"); setMode("mfa-verify"); }}
            >
              <span className="password-form__mfa-icon">&#128231;</span>
              <span>{t.auth.mfa.emailCode}</span>
              {emailHint && <span className="password-form__mfa-hint">{emailHint}</span>}
            </button>
          )}
          {mfaMethods.includes("passkey") && (
            <button
              type="button"
              className="password-form__mfa-btn"
              onClick={() => { setSelectedMethod("passkey"); handleMfaVerify(); }}
              disabled={saving}
            >
              <span className="password-form__mfa-icon">&#128273;</span>
              <span>{t.auth.mfa.passkey}</span>
            </button>
          )}
        </div>

        <div className="password-form__actions">
          <Button variant="ghost" type="button" onClick={() => { setMode("change"); setFormError(null); }} disabled={saving}>
            {t.common.back}
          </Button>
        </div>

        {formError && <div className="alert alert--error">{formError}</div>}
      </div>
    );
  }

  if (mode === "mfa-verify") {
    return (
      <div className="password-form password-form--mfa">
        <p className="password-form__mfa-title">
          {selectedMethod === "totp" ? t.auth.mfa.enterTotp : t.auth.mfa.enterCode}
        </p>
        <p className="password-form__mfa-subtitle">
          {selectedMethod === "totp" ? t.auth.mfa.totpSubtitle : `${t.auth.mfa.emailSubtitle} ${emailHint}`}
        </p>

        {selectedMethod !== "passkey" && (
          <Input
            label={selectedMethod === "totp" ? "TOTP" : t.auth.mfa.codePlaceholder}
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder={t.auth.mfa.codePlaceholder}
            autoComplete="one-time-code"
            required
          />
        )}

        <div className="password-form__group" style={{ marginTop: "16px" }}>
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

        <div className="password-form__actions">
          <Button variant="ghost" type="button" onClick={() => { setMode("mfa-select"); setMfaCode(""); setFormError(null); }} disabled={saving}>
            {t.common.back}
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={selectedMethod !== "passkey" ? (!mfaCode || !newPassword || !confirmPassword) : (!newPassword || !confirmPassword)}
            onClick={handleMfaVerify}
          >
            {t.profile.resetPassword}
          </Button>
        </div>
      </div>
    );
  }

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

      {hasPassword && (
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
