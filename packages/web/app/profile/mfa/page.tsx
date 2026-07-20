"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

export default function MfaSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totpSetup, setTotpSetup] = useState<any>(null);
  const [totpCode, setTotpCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/user/profile", {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setProfile(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSetupTotp = async () => {
    setActionLoading(true);
    const res = await fetch("/api/v1/mfa/totp/setup", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    const json = await res.json();
    if (json.ok) setTotpSetup(json.data);
    setActionLoading(false);
  };

  const handleEnableTotp = async () => {
    setActionLoading(true);
    const res = await fetch("/api/v1/mfa/totp/enable", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({ code: totpCode }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile({ ...profile, totpEnabled: true });
      setTotpSetup(null);
      setTotpCode("");
    }
    setActionLoading(false);
  };

  const handleDisableTotp = async () => {
    setActionLoading(true);
    const res = await fetch("/api/v1/mfa/totp/disable", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({ code: totpCode }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile({ ...profile, totpEnabled: false });
      setTotpCode("");
    }
    setActionLoading(false);
  };

  const handleSetupEmailMfa = async () => {
    setActionLoading(true);
    const res = await fetch("/api/v1/mfa/email/setup", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    });
    const json = await res.json();
    if (json.ok) {
      setProfile({ ...profile, emailMfaPending: true });
    }
    setActionLoading(false);
  };

  const handleEnableEmailMfa = async () => {
    setActionLoading(true);
    const res = await fetch("/api/v1/mfa/email/enable", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
      },
      body: JSON.stringify({ code: emailCode }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile({ ...profile, emailMfaEnabled: true, emailMfaPending: false });
      setEmailCode("");
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      <div>
        <h1 className="text-xl font-bold text-content">Two-factor authentication</h1>
        <p className="text-sm text-muted mt-0.5">Add an extra layer of security</p>
      </div>

      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-dim hover:text-content transition-colors">
        <Icon name="arrow-left" size={16} />
        Back to Profile
      </Link>

      {/* TOTP */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Icon name="shield" size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-content">Authenticator app</p>
              <p className="text-xs text-muted">Google Authenticator, Authy</p>
            </div>
          </div>
          {profile?.totpEnabled ? (
            <span className="text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-badge">Enabled</span>
          ) : (
            <span className="text-xs font-medium text-muted bg-surface-row px-2.5 py-1 rounded-badge">Not enabled</span>
          )}
        </div>

        {totpSetup ? (
          <div className="flex flex-col gap-4 mt-4 p-4 bg-surface-hover rounded-card">
            <div className="text-center">
              <img src={totpSetup.qr_code_url} alt="QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted mb-1">Or enter manually:</p>
              <code className="text-sm font-mono text-content bg-surface px-3 py-1.5 rounded">{totpSetup.secret}</code>
            </div>
            <Input
              label="Enter code from app"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <Button onClick={handleEnableTotp} loading={actionLoading} className="w-full">
              Verify & Enable
            </Button>
          </div>
        ) : profile?.totpEnabled ? (
          <div className="mt-4">
            <Input
              label="Enter code to disable"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <Button variant="danger" size="sm" onClick={handleDisableTotp} loading={actionLoading} className="mt-3">
              Disable TOTP
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleSetupTotp} loading={actionLoading}>
            Enable authenticator app
          </Button>
        )}
      </Card>

      {/* Email MFA */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Icon name="envelope" size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-content">Email codes</p>
              <p className="text-xs text-muted">Receive a code via email when signing in</p>
            </div>
          </div>
          {profile?.emailMfaEnabled ? (
            <span className="text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-badge">Enabled</span>
          ) : (
            <span className="text-xs font-medium text-muted bg-surface-row px-2.5 py-1 rounded-badge">Not enabled</span>
          )}
        </div>

        {profile?.emailMfaPending ? (
          <div className="mt-4">
            <Input
              label="Enter verification code"
              placeholder="000000"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <Button onClick={handleEnableEmailMfa} loading={actionLoading} className="mt-3 w-full">
              Verify & Enable
            </Button>
          </div>
        ) : profile?.emailMfaEnabled ? (
          <div className="mt-4">
            <Input
              label="Enter code to disable"
              placeholder="000000"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <Button variant="danger" size="sm" onClick={() => {}} loading={actionLoading} className="mt-3">
              Disable email codes
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleSetupEmailMfa} loading={actionLoading}>
            Enable email codes
          </Button>
        )}
      </Card>
    </div>
  );
}
