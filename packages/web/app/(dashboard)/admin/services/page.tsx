"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/lib/use-page-title";

interface AdminService {
  id: string;
  clientId: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  connectionCount: number;
  owner: { id: string; email: string; displayName?: string | null };
}

export default function AdminServicesPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.services);
  const { data, isLoading, mutate, refresh } = useCachedQuery<AdminService[]>("/admin/services");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const services = data ?? [];

  const toggleActive = async (service: AdminService) => {
    setActionId(service.id);
    setError(null);
    try {
      await api(`/admin/services/${service.id}/active`, {
        method: "POST",
        body: { isActive: !service.isActive },
      });
      mutate((current) =>
        (current ?? []).map((item) =>
          item.id === service.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionId(null);
    }
  };

  const remove = async (service: AdminService) => {
    if (!window.confirm(t.admin.deleteServiceConfirm.replace("{{name}}", service.displayName || service.name))) {
      return;
    }
    setActionId(service.id);
    setError(null);
    try {
      await api(`/admin/services/${service.id}`, { method: "DELETE" });
      mutate((current) => (current ?? []).filter((item) => item.id !== service.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setActionId(null);
    }
  };

  if (isLoading && !data) {
    return <ListPageSkeleton rows={4} />;
  }

  return (
    <div className="panel-page">
      <div className="panel-page__header panel-page__header--row">
        <div>
          <h1>{t.admin.servicesTitle}</h1>
          <p>{t.admin.servicesCount.replace("{{count}}", String(services.length))}</p>
        </div>
        <Button variant="ghost" onClick={() => refresh()}>
          {t.common.refresh}
        </Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {services.length === 0 ? (
        <div className="empty-panel">
          <p className="empty-panel__title">{t.admin.noServices}</p>
          <p className="empty-panel__desc">{t.admin.noServicesDesc}</p>
        </div>
      ) : (
        <div className="admin-users">
          {services.map((service) => (
            <div key={service.id} className="admin-user-row">
              <div className="list-row__icon-wrap list-row__icon-wrap--app">
                {service.logoUrl ? (
                  <Image src={service.logoUrl} alt="" width={18} height={18} unoptimized />
                ) : (
                  <Icon name="apps" size={18} />
                )}
              </div>
              <div className="admin-user-row__main">
                <div className="admin-user-row__top">
                  <p className="admin-user-row__name">{service.displayName || service.name}</p>
                  <span
                    className={`admin-pill admin-pill--status-${service.isActive ? "active" : "banned"}`}
                  >
                    {service.isActive ? t.admin.active : t.admin.disabled}
                  </span>
                </div>
                <p className="admin-user-row__email font-mono">{service.clientId}</p>
                <p className="admin-user-row__meta">
                  {service.owner.displayName || service.owner.email}
                  {" · "}
                  {t.admin.connectionsCount.replace("{{count}}", String(service.connectionCount))}
                </p>
              </div>
              <div className="admin-user-row__actions">
                <button
                  type="button"
                  className="icon-btn"
                  title={service.isActive ? t.admin.disable : t.admin.enable}
                  aria-label={service.isActive ? t.admin.disable : t.admin.enable}
                  disabled={actionId === service.id}
                  onClick={() => toggleActive(service)}
                >
                  <Icon name={service.isActive ? "pause" : "play"} size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  title={t.common.delete}
                  aria-label={t.common.delete}
                  disabled={actionId === service.id}
                  onClick={() => remove(service)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
