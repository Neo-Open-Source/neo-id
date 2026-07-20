"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/user/profile", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setProfile(json.data);
          setDisplayName(json.data.displayName || "");
          setFirstName(json.data.firstName || "");
          setLastName(json.data.lastName || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/v1/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({ displayName, firstName, lastName }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile({ ...profile, displayName, firstName, lastName });
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-content">Profile</h1>
        <p className="text-sm text-muted mt-0.5">Manage your personal information</p>
      </div>

      {/* Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Link href="/profile/password" className="relative cursor-pointer rounded-full group">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent/60 p-0.5">
                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center overflow-hidden">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <Icon name="user" size={36} className="text-dim" />
                  )}
                </div>
              </div>
              <div className="absolute inset-0.5 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Icon name="camera" size={18} className="text-white" />
              </div>
            </Link>
          </div>

          {/* Fields */}
          <div className="flex-1 w-full">
            {editing ? (
              <div className="flex flex-col gap-3.5">
                <Input
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3.5">
                  <Input
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Input
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} loading={saving}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-content">
                      {profile.displayName || profile.email}
                    </p>
                    {profile.displayName && (
                      <p className="text-sm text-muted">{profile.email}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    <Icon name="pencil" size={14} />
                    Edit
                  </Button>
                </div>
                {profile.firstName && (
                  <p className="text-sm text-muted">
                    {profile.firstName} {profile.lastName}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-0 divide-y divide-border/50">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2.5">
          <Icon name="shield" size={16} className="text-dim" />
          <h2 className="text-sm font-semibold text-content">Security</h2>
        </div>
        <Link href="/profile/password" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors border-b border-border/50">
          <Icon name="key" size={18} className="text-dim" />
          <span className="flex-1 text-sm font-medium text-content">Password</span>
          <span className="text-xs text-muted">{profile.hasPassword ? "••••••••" : "Not set"}</span>
          <Icon name="angle-small-right" size={16} className="text-dim" />
        </Link>
        <Link href="/profile/mfa" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors border-b border-border/50">
          <Icon name="shield" size={18} className="text-dim" />
          <span className="flex-1 text-sm font-medium text-content">Two-step authentication</span>
          <span className="text-xs text-muted">
            {profile.totpEnabled || profile.emailMfaEnabled ? "Enabled" : "Not enabled"}
          </span>
          <Icon name="angle-small-right" size={16} className="text-dim" />
        </Link>
        <Link href="/profile/passkeys" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors">
          <Icon name="fingerprint" size={18} className="text-dim" />
          <span className="flex-1 text-sm font-medium text-content">Passkeys</span>
          <Icon name="angle-small-right" size={16} className="text-dim" />
        </Link>
      </Card>

      {/* Account */}
      <Card className="p-0 divide-y divide-border/50">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2.5">
          <Icon name="cog" size={16} className="text-dim" />
          <h2 className="text-sm font-semibold text-content">Account</h2>
        </div>
        <Link href="/profile/email" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors border-b border-border/50">
          <Icon name="envelope" size={18} className="text-dim" />
          <span className="flex-1 text-sm font-medium text-content">Email</span>
          <span className="text-xs text-muted truncate max-w-[160px]">{profile.email}</span>
          <Icon name="angle-small-right" size={16} className="text-dim" />
        </Link>
        <Link href="/sessions" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors">
          <Icon name="clock" size={18} className="text-dim" />
          <span className="flex-1 text-sm font-medium text-content">Sessions</span>
          <Icon name="angle-small-right" size={16} className="text-dim" />
        </Link>
      </Card>
    </div>
  );
}
