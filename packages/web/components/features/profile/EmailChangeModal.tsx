"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError } from "@/lib/api";

interface EmailChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
}

export function EmailChangeModal({ open, onClose, currentEmail }: EmailChangeModalProps) {
  const { t } = useI18n();
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClose = () => {
    setNewEmail("");
    setCode("");
    setStep("idle");
    setMessage(null);
    onClose();
  };

  const requestCode = async () => {
    if (!newEmail || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      await api("/user/email/change/request", { method: "POST", body: { newEmail } });
      setStep("code");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!code || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      await api("/user/email/change/confirm", { method: "POST", body: { newEmail, code } });
      window.location.href = "/profile";
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.profile.changeEmailTitle}
      footer={
        <Button
          size="sm"
          loading={loading}
          disabled={step === "idle" ? !newEmail : code.length !== 6}
          onClick={step === "idle" ? requestCode : confirm}
        >
          {step === "idle" ? t.profile.verifyEmail : t.profile.confirmEmailChange}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t.profile.changeEmailDesc}</p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-content">{t.profile.currentEmail}</label>
          <div className="px-4 py-2.5 text-sm bg-surface-row rounded-input text-dim">
            {currentEmail}
          </div>
        </div>

        {step === "idle" ? (
          <Input
            label={t.profile.newEmail}
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t.auth.emailPlaceholder}
            autoFocus
          />
        ) : (
          <Input
            label={t.profile.emailChangeCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t.auth.mfa.codePlaceholder}
            autoFocus
          />
        )}

        {step === "code" && (
          <p className="text-xs text-muted">{t.profile.emailChangeCodeHint}</p>
        )}

        {message && <div className="alert alert--error">{message}</div>}
      </div>
    </Modal>
  );
}
