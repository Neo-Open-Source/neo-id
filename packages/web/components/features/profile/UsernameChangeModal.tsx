"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

interface UsernameChangeModalProps {
  open: boolean;
  currentUsername?: string | null;
  onClose: () => void;
  onSaved: (username: string) => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export function UsernameChangeModal({
  open,
  currentUsername,
  onClose,
  onSaved,
}: UsernameChangeModalProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(currentUsername || "");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(currentUsername || "");
    setAvailability("idle");
    setError(null);
  }, [open, currentUsername]);

  useEffect(() => {
    if (!open) return;

    const trimmed = value.trim();
    if (!trimmed) {
      setAvailability("idle");
      return;
    }

    if (
      trimmed.length < 3 ||
      trimmed.length > 30 ||
      !USERNAME_RE.test(trimmed)
    ) {
      setAvailability("invalid");
      return;
    }

    if (
      currentUsername &&
      trimmed.toLowerCase() === currentUsername.toLowerCase()
    ) {
      setAvailability("available");
      return;
    }

    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ available: boolean; reason: string }>(
          `/user/username/check?username=${encodeURIComponent(trimmed)}`,
        );
        if (result.available) setAvailability("available");
        else if (result.reason === "invalid") setAvailability("invalid");
        else setAvailability("taken");
      } catch {
        setAvailability("idle");
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [value, open, currentUsername]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (saving || availability !== "available") return;
    if (currentUsername && trimmed.toLowerCase() === currentUsername.toLowerCase()) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await api<{ username: string }>("/user/profile", {
        method: "PUT",
        body: { username: trimmed },
      });
      onSaved(data.username);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.saveFailed);
      if (e instanceof ApiError && e.code === "USERNAME_TAKEN") {
        setAvailability("taken");
      }
    } finally {
      setSaving(false);
    }
  };

  const statusHint =
    availability === "available"
      ? t.profile.usernameAvailable
      : availability === "taken"
        ? t.profile.usernameTaken
        : availability === "invalid"
          ? t.profile.usernameInvalid
          : null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title={t.profile.editUsername}
      description={t.profile.editUsernameDesc}
      size="sm"
      footerLayout="stacked"
      footer={
        <Button
          className="modal-footer__primary"
          onClick={handleSave}
          loading={saving}
          disabled={availability !== "available" || saving}
        >
          {t.common.save}
        </Button>
      }
    >
      <div className="modal-form">
        <div className="input-wrapper">
          <label className="input-label">{t.profile.username}</label>
          <div className="username-field">
            <input
              className={cn(
                "input username-field__input",
                availability === "taken" || availability === "invalid"
                  ? "input--error"
                  : undefined,
              )}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t.profile.usernamePlaceholder}
              autoFocus
              autoComplete="username"
              spellCheck={false}
            />
            {(availability === "available" || availability === "taken") && (
              <span
                className={cn(
                  "username-status",
                  availability === "available"
                    ? "username-status--ok"
                    : "username-status--bad",
                )}
                aria-hidden
              >
                <Icon
                  name={availability === "available" ? "check" : "cross"}
                  size={12}
                />
              </span>
            )}
            {availability === "checking" && (
              <span className="username-status username-status--pending" aria-hidden>
                <span className="username-status__dot" />
              </span>
            )}
          </div>
          {statusHint && (
            <span
              className={cn(
                "input-hint",
                availability === "available" && "input-hint--ok",
                (availability === "taken" || availability === "invalid") &&
                  "input-hint--error",
              )}
            >
              {statusHint}
            </span>
          )}
        </div>
        {error && <div className="alert alert--error">{error}</div>}
      </div>
    </Modal>
  );
}
