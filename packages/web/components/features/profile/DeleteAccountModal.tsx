"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError, logoutSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

interface DeleteAccountModalProps {
  open: boolean;
  hasPassword: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ open, hasPassword, onClose }: DeleteAccountModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    if (hasPassword && !password) return;
    setDeleting(true);
    setError(null);
    try {
      await api("/user", {
        method: "DELETE",
        body: { password: password || undefined },
      });
      await logoutSession();
      router.replace("/auth");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.profile.deleteAccount}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            disabled={hasPassword && !password}
          >
            {t.profile.deleteAccount}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t.profile.deleteAccountDesc}</p>
        {hasPassword && (
          <Input
            label={t.profile.enterPasswordConfirm}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        )}
        {error && <div className="alert alert--error">{error}</div>}
      </div>
    </Modal>
  );
}
