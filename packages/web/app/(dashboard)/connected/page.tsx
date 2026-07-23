"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

interface Connection {
  id: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
  app: {
    id: string;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    website?: string | null;
  };
}

export default function ConnectedPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.connected);
  const { data: connections, error, mutate, refresh } =
    useCachedQuery<Connection[]>("/user/connections");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api(`/user/connections/${id}`, { method: "DELETE" });
      mutate((current) => (current ?? []).filter((item) => item.id !== id));
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setRevokingId(null);
    }
  };

  if (!connections) {
    if (error) {
      return (
        <div className="page profile-page">
          <div className="alert alert--error">{error}</div>
          <Button onClick={() => refresh()}>{t.common.refresh}</Button>
        </div>
      );
    }
    return <ListPageSkeleton rows={3} />;
  }

  const items = connections;

  return (
    <div className="page profile-page">
      <div className="page-intro">
        <h1 className="page-intro__title">{t.connected.title}</h1>
        <p className="page-intro__desc">{t.connected.subtitle}</p>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-panel__icon">
            <Icon name="apps" size={28} />
          </div>
          <p className="empty-panel__title">{t.connected.noConnected}</p>
          <p className="empty-panel__desc">{t.connected.noConnectedDesc}</p>
        </div>
      ) : (
        <div className="profile-group">
          {items.map((connection) => (
            <div key={connection.id} className="list-row">
              <div className="list-row__icon-wrap list-row__icon-wrap--app">
                {connection.app.logoUrl ? (
                  <img src={connection.app.logoUrl} alt="" />
                ) : (
                  <Icon name="apps" size={18} />
                )}
              </div>
              <div className="list-row__content">
                <p className="list-row__title">{connection.app.name}</p>
                <p className="list-row__meta">
                  {t.connected.lastUsed.replace(
                    "{{date}}",
                    new Date(connection.lastUsedAt).toLocaleDateString(),
                  )}
                </p>
                {connection.app.description && (
                  <p className="list-row__desc">{connection.app.description}</p>
                )}
              </div>
              <div className="list-row__actions">
                {connection.app.website && (
                  <a
                    href={connection.app.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="list-row__link"
                  >
                    {t.connected.openApp}
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  loading={revokingId === connection.id}
                  onClick={() => handleRevoke(connection.id)}
                >
                  {t.connected.revokeAccess}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="page-footer-actions">
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          {t.common.refresh}
        </Button>
      </div>
    </div>
  );
}
