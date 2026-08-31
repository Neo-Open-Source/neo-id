"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api, apiUpload, ApiError } from "@/lib/api";

interface Profile {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export default function SetupPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.setup);
  const router = useRouter();
  const { data: profile, error, mutate } = useCachedQuery<Profile>("/user/profile");

  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const data = await apiUpload<{ avatar: string }>("/user/avatar", formData);
      mutate((prev) => (prev ? { ...prev, avatar: data.avatar } : prev));
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : t.common.uploadFailed);
    }
  };

  const handleSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api("/user/profile", {
        method: "PUT",
        body: { displayName, firstName, lastName },
      });
      router.push("/profile");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push("/profile");
  };

  if (!profile) {
    if (error) {
      return (
        <div className="page setup-page">
          <div className="alert alert--error">{error}</div>
        </div>
      );
    }
    return (
      <div className="page setup-page">
        <div className="loading"><div className="loading__spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page setup-page">
      <div className="setup-card">
        <div className="setup-card__header">
          <h1>{t.setup.title}</h1>
          <p>{t.setup.subtitle}</p>
        </div>

        <div className="setup-card__avatar">
          <AvatarUpload
            src={profile.avatar}
            name={displayName || profile.email}
            size="lg"
            menuStyle
            onUpload={handleAvatarUpload}
            onSaved={(avatar) => mutate((prev) => (prev ? { ...prev, avatar } : prev))}
          />
        </div>

        <div className="setup-card__form">
          <Input
            label={t.setup.displayName}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t.setup.displayNamePlaceholder}
            autoFocus
          />
          <div className="setup-card__row">
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
          {saveError && <div className="alert alert--error">{saveError}</div>}
        </div>

        <div className="setup-card__actions">
          <Button onClick={handleSave} loading={saving}>
            {t.setup.continue}
          </Button>
          <button
            type="button"
            className="setup-card__skip"
            onClick={handleSkip}
          >
            {t.setup.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
