"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import { api, ApiError, hasSession } from "@/lib/api";
import { readCache } from "@/lib/cache";
import { AnonymousTicket } from "@/components/features/support/AnonymousTicket";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  messageCount: number;
}

export default function SupportPage() {
  const { t } = useI18n();
  const router = useRouter();
  usePageTitle(t.support.title);

  const [authenticated, setAuthenticated] = useState<boolean | null>(() =>
    readCache("/user/profile") ? true : null,
  );
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await api<Ticket[]>("/support/tickets");
      setTickets(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setLoaded(true);
    }
  }, [t.common.error]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (readCache("/user/profile")) {
        setAuthenticated(true);
        await fetchTickets();
        return;
      }

      const authed = await hasSession();
      if (cancelled) return;
      setAuthenticated(authed);
      if (authed) await fetchTickets();
      else setLoaded(true);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || creating) return;
    setCreating(true);
    try {
      const result = await api<{ id: string }>("/support/tickets", { method: "POST", body: { subject, message } });
      setShowNew(false);
      setSubject("");
      setMessage("");
      router.push(`/support/${result.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setCreating(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="loading__spinner" />
      </div>
    );
  }

  if (!authenticated) {
    return <AnonymousTicket />;
  }

  return (
    <div className="panel-page">
      <div className="panel-page__header panel-page__header--row">
        <div>
          <h1>{t.support.title}</h1>
          <p>{t.support.subtitle}</p>
        </div>
        <Button onClick={() => setShowNew(true)}>{t.support.newTicket}</Button>
      </div>

      {!loaded ? null : tickets.length === 0 ? (
        <div className="empty-panel">
          <p className="empty-panel__title">{t.support.noTickets}</p>
          <p className="empty-panel__desc">{t.support.noTicketsDesc}</p>
        </div>
      ) : (
        <div className="support-list">
          {tickets.map((ticket) => (
            <button key={ticket.id} type="button" className="support-row" onClick={() => router.push(`/support/${ticket.id}`)}>
              <div className="support-row__top">
                <strong>{ticket.subject}</strong>
                <span className={`admin-pill admin-pill--status-${ticket.status}`}>
                  {ticket.status === "closed" ? t.support.closed : t.support.open}
                </span>
              </div>
              <p className="support-row__meta">
                {ticket.messageCount} messages · {new Date(ticket.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title={t.support.newTicket} size="sm">
        <form onSubmit={handleCreate} className="support-form">
          <Input label={t.support.subject} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.support.subjectPlaceholder} required />
          <div className="input-wrapper">
            <label className="input-label">{t.support.message}</label>
            <textarea
              className="input input--textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.support.messagePlaceholder}
              rows={4}
              required
            />
          </div>
          <Button type="submit" loading={creating} disabled={!subject.trim() || !message.trim()}>
            {t.support.send}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
