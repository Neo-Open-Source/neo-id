"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

function bufferToBase64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function serializeCredential(credential: PublicKeyCredential): any {
  const response = credential.response as any;
  return {
    id: credential.id,
    rawId: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      transports: response.getTransports?.() || [],
    },
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export default function PasskeysPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.passkeys);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api("/passkeys")
      .then((data) => setPasskeys(data || []))
      .catch(() => toast.error(t.common.error))
      .finally(() => setLoading(false));
  }, [t.common.error]);

  const handleAdd = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const startData = await api("/passkeys/register/start", { method: "POST" });

      // Convert base64url strings to ArrayBuffers for navigator.credentials.create
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        rp: startData.rp,
        challenge: base64urlToBuffer(startData.challenge),
        user: {
          ...startData.user,
          id: base64urlToBuffer(startData.user.id),
        },
        pubKeyCredParams: startData.pubKeyCredParams,
        timeout: startData.timeout,
        excludeCredentials: (startData.excludeCredentials || []).map((cred: any) => ({
          id: base64urlToBuffer(cred.id),
          type: "public-key" as const,
          transports: cred.transports as AuthenticatorTransport[] | undefined,
        })),
        attestation: "none" as const,
        authenticatorSelection: startData.authenticatorSelection,
      };

      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
      if (!credential) throw new Error("Credential creation cancelled");

      const serialized = serializeCredential(credential as PublicKeyCredential);
      const finishData = await api("/passkeys/register/finish", {
        method: "POST",
        body: {
          response: serialized,
          expectedChallenge: startData.challenge,
          deviceName: navigator.userAgent.includes("Mobile") ? t.profile.mobile : t.profile.desktop,
        },
      });
      setPasskeys((prev) => [...prev, finishData]);
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await api(`/passkeys/${id}`, { method: "DELETE" });
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="loading__spinner" /></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <BackButton href="/profile" label={t.profile.backToProfile} />
        <h1 className="page-title">{t.profile.passkeys}</h1>
        <p className="page-subtitle">{t.profile.passkeysSubtitle}</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4 max-sm:flex-col max-sm:items-stretch">
          <p className="text-sm text-muted">
            {t.profile.passkeysRegistered.replace("{{count}}", String(passkeys.length))}
          </p>
          <Button size="sm" onClick={handleAdd} loading={actionLoading}>
            <Icon name="plus" size={14} />
            {t.profile.addPasskey}
          </Button>
        </div>

        {passkeys.length === 0 ? (
          <div className="empty-panel">
            <p className="empty-panel__title">{t.profile.noPasskeys}</p>
            <p className="empty-panel__desc">{t.profile.noPasskeysDesc}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {passkeys.map((passkey) => (
              <div key={passkey.id} className="list-row">
                <div className="list-row__icon-wrap">
                  <Icon name="fingerprint" size={18} />
                </div>
                <div className="list-row__content">
                  <p className="list-row__title">{passkey.deviceName || t.profile.passkeyFallback}</p>
                  <p className="list-row__meta">
                    {t.profile.addedDate.replace(
                      "{{date}}",
                      new Date(passkey.createdAt).toLocaleDateString(),
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  loading={actionLoading}
                  onClick={() => handleDelete(passkey.id)}
                >
                  {t.common.delete}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
