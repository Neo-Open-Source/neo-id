"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/services", {
      headers: { Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setServices(json.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content">Services</h1>
          <p className="text-sm text-muted mt-0.5">{services.length} service(s)</p>
        </div>
        <Link href="/developer/services/new">
          <Button size="sm">
            <Icon name="plus" size={14} />
            New service
          </Button>
        </Link>
      </div>

      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon name="key" size={32} className="text-dim mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">No services yet</p>
          <Link href="/developer/services/new">
            <Button size="sm">Create your first service</Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <Link key={service.id} href={`/developer/services/${service.id}`}>
              <Card hover className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-row flex items-center justify-center shrink-0">
                    {service.logoUrl ? (
                      <img src={service.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Icon name="key" size={20} className="text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-content">
                      {service.displayName || service.name}
                    </p>
                    <p className="text-xs text-dim font-mono">{service.clientId}</p>
                    {service.description && (
                      <p className="text-xs text-dim mt-1">{service.description}</p>
                    )}
                  </div>
                  <Icon name="angle-small-right" size={16} className="text-dim" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
