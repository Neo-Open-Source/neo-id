"use client";

import { useState } from "react";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { GoogleIcon, GithubIcon } from "@/components/ui/ProviderIcons";
import { useI18n } from "@/lib/i18n/context";
import { api } from "@/lib/api";

interface Identity {
  id: string;
  provider: string;
  createdAt: string;
}

const providers = [
  { id: "google", name: "Google", Icon: GoogleIcon },
  { id: "github", name: "GitHub", Icon: GithubIcon },
] as const;

interface LoginMethodRowsProps {
  identities: Identity[];
  onChanged: () => void;
}

export function LoginMethodRows({ identities, onChanged }: LoginMethodRowsProps) {
  const { t } = useI18n();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [disconnectProvider, setDisconnectProvider] = useState<string | null>(null);

  const handleConnect = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      const data = await api<{ url: string }>(`/auth/oauth/${provider}/link`, {
        method: "POST",
        body: { return_to: `${window.location.origin}/profile` },
      });
      window.location.href = data.url;
    } catch {
      setLoadingProvider(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectProvider || loadingProvider) return;
    setLoadingProvider(disconnectProvider);
    try {
      await api(`/user/identities/${disconnectProvider}`, { method: "DELETE" });
      onChanged();
      setDisconnectProvider(null);
    } finally {
      setLoadingProvider(null);
    }
  };

  const disconnectName = providers.find((item) => item.id === disconnectProvider)?.name;

  return (
    <>
      {providers.map((provider) => {
        const connected = identities.some((item) => item.provider === provider.id);
        const ProviderIcon = provider.Icon;

        return (
          <SettingsRow
            key={provider.id}
            leading={
              <span className={`provider-icon provider-icon--${provider.id}`}>
                <ProviderIcon size={20} />
              </span>
            }
            label={provider.name}
            value={connected ? t.common.enabled : t.profile.notConnected}
            onClick={() => {
              if (loadingProvider) return;
              if (connected) setDisconnectProvider(provider.id);
              else void handleConnect(provider.id);
            }}
          />
        );
      })}

      <Modal
        open={Boolean(disconnectProvider)}
        onClose={() => setDisconnectProvider(null)}
        title={t.profile.disconnectProvider}
        description={t.profile.disconnectProviderDesc.replace("{{provider}}", disconnectName || "")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisconnectProvider(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={Boolean(loadingProvider)}
              onClick={handleDisconnect}
            >
              {t.common.disconnect}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t.profile.disconnectProviderHint}</p>
      </Modal>
    </>
  );
}
