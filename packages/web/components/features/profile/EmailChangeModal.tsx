"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

interface EmailChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
}

export function EmailChangeModal({ open, onClose, currentEmail }: EmailChangeModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClose = () => {
    setNewEmail("");
    setMessage(null);
    onClose();
  };

  const normalizedCurrentEmail = currentEmail.trim().toLowerCase();
  const normalizedNewEmail = newEmail.trim().toLowerCase();
  const isSameEmail = normalizedNewEmail.length > 0 && normalizedNewEmail === normalizedCurrentEmail;

  const handleSubmit = async () => {
    if (!newEmail || loading) return;
    if (isSameEmail) {
      setMessage(t.profile.sameEmail);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // Request a challenge — the API returns which MFA methods are available
      const challenge = await api<{ methods?: string[]; emailHint?: string }>(
        "/user/email/change/challenge",
        { method: "POST", body: { newEmail } },
      );
      const methods = challenge?.methods?.length ? challenge.methods : ["email"];
      const params = new URLSearchParams({
        purpose: "email_change",
        email: currentEmail,
        newEmail,
        methods: methods.join(","),
      });
      if (challenge?.emailHint) params.set("emailHint", challenge.emailHint);
      onClose();
      router.push(`/auth/2fa?${params.toString()}`);
    } catch (error) {
      const localizedMessage =
        error instanceof ApiError && error.code === "SAME_EMAIL"
          ? t.profile.sameEmail
          : null;
      setMessage(localizedMessage ?? (error instanceof ApiError ? error.message : t.common.error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.profile.changeEmailTitle}
      description={t.profile.changeEmailDesc}
      size="sm"
      footer={
        <Button
          loading={loading}
          disabled={!newEmail || isSameEmail}
          onClick={handleSubmit}
        >
          {t.profile.verifyEmail}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-content">{t.profile.currentEmail}</label>
          <div className="px-4 py-2.5 text-sm bg-surface-row rounded-input text-dim">
            {currentEmail}
          </div>
        </div>

        <Input
          label={t.profile.newEmail}
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={t.auth.emailPlaceholder}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />

        {(isSameEmail ? t.profile.sameEmail : message) && (
          <div className="alert alert--error" role="alert">
            {isSameEmail ? t.profile.sameEmail : message}
          </div>
        )}
      </div>
    </Modal>
  );
}
