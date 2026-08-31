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

interface Session {
  id: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  createdAt: string;
  lastActiveAt: string;
}

function sessionDeviceLabel(session: Session) {
  const info = session.deviceInfo?.toLowerCase() || "";
  if (info.includes("mobile") || info.includes("iphone") || info.includes("android")) {
    return "mobile";
  }
  if (info.includes("tablet") || info.includes("ipad")) {
    return "tablet";
  }
  return "desktop";
}

export default function SessionsPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.sessions);
  const { data: sessions, error, mutate, refresh } =
    useCachedQuery<Session[]>("/sessions");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api(`/sessions/${id}`, { method: "DELETE" });
      mutate((current) => (current ?? []).filter((item) => item.id !== id));
      toast.success(t.common.success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setRevokingId(null);
    }
  };

  if (!sessions) {
    if (error) {
      return (
        <div className="page profile-page">
          <div className="alert alert--error">{error}</div>
          <Button onClick={() => refresh()}>{t.common.refresh}</Button>
        </div>
      );
    }
    return <ListPageSkeleton rows={4} />;
  }

  const items = sessions;

  return (
    <div className="page profile-page">
      <div className="page-intro">
        <h1 className="page-intro__title">{t.sessions.title}</h1>
        <p className="page-intro__desc">{t.sessions.subtitle}</p>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-panel__icon">
            <Icon name="laptop" size={28} />
          </div>
          <p className="empty-panel__title">{t.sessions.empty}</p>
          <p className="empty-panel__desc">{t.sessions.emptyDesc}</p>
        </div>
      ) : (
        <div className="profile-group">
          {items.map((session) => {
            const device = sessionDeviceLabel(session);
            const icon = device === "mobile" ? "mobile" : device === "tablet" ? "tablet" : "laptop";

            return (
              <div key={session.id} className="list-row">
                <div className="list-row__icon-wrap">
                  <Icon name={icon} size={18} />
                </div>
                <div className="list-row__content">
                  <p className="list-row__title">
                    {session.deviceInfo || t.sessions.unknownDevice}
                  </p>
                  <p className="list-row__meta">
                    {[session.location, session.ipAddress].filter(Boolean).join(" · ") ||
                      t.sessions.unknownLocation}
                  </p>
                  <p className="list-row__desc">
                    {t.sessions.lastActive.replace(
                      "{{date}}",
                      new Date(session.lastActiveAt).toLocaleString(),
                    )}
                  </p>
                </div>
                <div className="list-row__actions">
                  <Button
                    variant="ghost"
                    className="text-danger"
                    loading={revokingId === session.id}
                    onClick={() => handleRevoke(session.id)}
                  >
                    {t.sessions.revoke}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="page-footer-actions">
        <Button variant="ghost" onClick={() => refresh()}>
          {t.common.refresh}
        </Button>
      </div>
    </div>
  );
}
