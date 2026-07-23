"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError } from "@/lib/api";

interface Ticket {
  id: string;
  email: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface TicketsResponse {
  tickets: Ticket[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default function AdminSupportPage() {
  const { t } = useI18n();
  const router = useRouter();
  usePageTitle("Support");

  const [data, setData] = useState<TicketsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  const fetchTickets = useCallback(async (p: number) => {
    try {
      const result = await api<TicketsResponse>(`/admin/support/tickets?page=${p}&limit=20`);
      setData(result);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoaded(true);
    }
  }, [t.common.error]);

  useEffect(() => { void fetchTickets(page); }, [page, fetchTickets]);

  const tickets = data?.tickets ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, pages: 0 };

  return (
    <div className="panel-page">
      <div className="panel-page__header">
        <h1>{t.admin.supportTitle}</h1>
        <p>{t.admin.supportCount.replace("{{count}}", String(pagination.total))}</p>
      </div>

      {!loaded ? null : tickets.length === 0 ? (
        <div className="empty-panel">
          <p className="empty-panel__title">{t.admin.noTickets}</p>
          <p className="empty-panel__desc">{t.admin.noTicketsDesc}</p>
        </div>
      ) : (
        <div className="admin-list">
          {tickets.map((ticket) => (
            <button key={ticket.id} type="button" className="admin-list-row" onClick={() => router.push(`/admin/support/${ticket.id}`)}>
              <div className="admin-list-row__main">
                <div className="admin-list-row__top">
                  <strong>{ticket.subject}</strong>
                  <span className={`admin-pill admin-pill--status-${ticket.status}`}>
                    {ticket.status === "closed" ? t.support.closed : t.support.open}
                  </span>
                </div>
                <p className="admin-list-row__sub">{ticket.email}</p>
                <p className="admin-list-row__meta">
                  {ticket.messageCount} messages · {new Date(ticket.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="admin-pagination">
          <span>{pagination.page} / {pagination.pages}</span>
          <div className="admin-pagination__btns">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t.common.back}
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
              {t.common.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
