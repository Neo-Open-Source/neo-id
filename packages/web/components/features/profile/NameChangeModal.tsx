"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

interface NameChangeModalProps {
  open: boolean;
  initial: { displayName?: string; firstName?: string; lastName?: string };
  onClose: () => void;
  onSaved: (data: { displayName?: string; firstName?: string; lastName?: string }) => void;
}

export function NameChangeModal({ open, initial, onClose, onSaved }: NameChangeModalProps) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(initial.displayName || "");
  const [firstName, setFirstName] = useState(initial.firstName || "");
  const [lastName, setLastName] = useState(initial.lastName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    displayName !== (initial.displayName ?? "") ||
    firstName !== (initial.firstName ?? "") ||
    lastName !== (initial.lastName ?? "");

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api("/user/profile", {
        method: "PUT",
        body: { displayName, firstName, lastName },
      });
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
        setError(null);
      }}
      title={t.profile.updateName}
      description={t.profile.updateNameDesc}
      size="sm"
      footerLayout="stacked"
      footer={
        <Button className="modal-footer__primary" onClick={handleSave} loading={saving} disabled={!hasChanges}>
          {t.profile.updateName}
        </Button>
      }
    >
      <div className="modal-form">
        <Input
          label={t.profile.preferredName}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t.profile.namePlaceholder}
          autoFocus
        />
        <div className="modal-form__row">
          <Input
            label={t.profile.firstName}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label={t.profile.lastName}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        {error && <div className="alert alert--error">{error}</div>}
      </div>
    </Modal>
  );
}
