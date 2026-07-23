"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  displayName?: string | null;
  clientId: string;
  description?: string | null;
  logoUrl?: string | null;
}

export default function ServicesPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.services);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/services")
      .then((data) => setServices(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="loading__spinner" /></div>;
  }

  return (
    <div className="panel-page">
      <div className="panel-page__header panel-page__header--row">
        <div>
          <h1>{t.developer.servicesCount.replace("{{count}}", String(services.length))}</h1>
        </div>
        <Link href="/developer/services/new">
          <Button size="sm">
            <Icon name="plus" size={14} />
            {t.developer.newService}
          </Button>
        </Link>
      </div>

      {services.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-panel__icon">
            <Icon name="apps" size={28} />
          </div>
          <p className="empty-panel__title">{t.developer.noServices}</p>
          <p className="empty-panel__desc">{t.developer.noServicesDesc}</p>
          <Link href="/developer/services/new" className="mt-2">
            <Button size="sm">{t.developer.createService}</Button>
          </Link>
        </div>
      ) : (
        <div className="admin-users">
          {services.map((service) => (
            <Link key={service.id} href={`/developer/services/${service.id}`} className="admin-user-row">
              <div className="list-row__icon-wrap list-row__icon-wrap--app">
                {service.logoUrl ? (
                  <img src={service.logoUrl} alt="" />
                ) : (
                  <Icon name="apps" size={18} />
                )}
              </div>
              <div className="admin-user-row__main">
                <p className="admin-user-row__name">{service.displayName || service.name}</p>
                <p className="admin-user-row__email font-mono">{service.clientId}</p>
                {service.description && (
                  <p className="admin-user-row__meta">{service.description}</p>
                )}
              </div>
              <Icon name="angle-small-right" size={16} className="text-dim" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
