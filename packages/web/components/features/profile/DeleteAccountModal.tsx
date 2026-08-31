"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

interface DeleteAccountModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
}

export function DeleteAccountModal({ open, email, onClose }: DeleteAccountModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account deletion uses the same step-up challenge as login/export:
  // the user picks passkey / TOTP / email code to confirm the deletion.
  const handleDelete = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const challenge = await api<{ methods?: string[]; emailHint?: string }>(
        "/user/delete/challenge",
        { method: "POST" },
      );
      const methods = challenge?.methods?.length ? challenge.methods : ["email"];
      const params = new URLSearchParams({
        purpose: "delete",
        email,
        methods: methods.join(","),
      });
      if (challenge?.emailHint) params.set("emailHint", challenge.emailHint);
      router.push(`/auth/2fa?${params.toString()}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
      setStarting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.profile.deleteAccount}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={starting}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={starting}
          >
            {t.profile.deleteAccount}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t.profile.deleteAccountDesc}</p>
        {error && <div className="alert alert--error">{error}</div>}
      </div>
    </Modal>
  );
}
