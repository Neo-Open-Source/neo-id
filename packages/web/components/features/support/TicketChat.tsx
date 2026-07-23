"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useTicketPolling } from "@/lib/useTicketPolling";

interface Message {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  email?: string;
  status: string;
  messages: Message[];
  createdAt: string;
}

interface TicketChatProps {
  ticketId: string;
  apiPath: string;
  replyPath: string;
  backPath: string;
  backLabel: string;
  showEmail?: boolean;
  showDelete?: boolean;
  authorLabel?: string;
  replyPlaceholder?: string;
  closeLabel?: string;
  reopenLabel?: string;
  deleteLabel?: string;
  currentRole?: string;
}

export function TicketChat({
  ticketId,
  apiPath,
  replyPath,
  backPath,
  backLabel,
  showEmail = false,
  showDelete = false,
  authorLabel,
  replyPlaceholder,
  closeLabel,
  reopenLabel,
  deleteLabel,
  currentRole = "user",
}: TicketChatProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<TicketDetail>(apiPath);
      setTicket(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
      router.replace(backPath);
    } finally {
      setLoading(false);
    }
  }, [apiPath, backPath, router, t.common.error]);

  useEffect(() => { void fetchTicket(); }, [fetchTicket]);

  useTicketPolling({
    ticketId,
    apiPath,
    enabled: !!ticket,
    onUpdate: (messages) => {
      setTicket((prev) => {
        if (!prev) return prev;
        const lastMsg = messages[messages.length - 1] as Message | undefined;
        if (!lastMsg) return prev;
        if (prev.messages.some((m) => m.id === lastMsg.id)) return prev;
        return { ...prev, messages: messages as Message[] };
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onStatus: (status) => {
      setTicket((prev) => prev ? { ...prev, status } : prev);
    },
  });

  const handleSend = async () => {
    if (!text.trim() || sending || !ticket) return;
    setSending(true);
    try {
      const result = await api<{ id: string }>(replyPath, { method: "POST", body: { message: text } });
      setTicket((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === result.id)) return prev;
        return { ...prev, messages: [...prev.messages, { id: result.id, authorRole: currentRole, body: text.trim(), createdAt: new Date().toISOString() }] };
      });
      setText("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setSending(false);
    }
  };

  const handleReopen = async () => {
    if (!ticket) return;
    try {
      await api(`${apiPath}/reopen`, { method: "POST" });
      toast.success(t.common.success);
      setTicket({ ...ticket, status: "open" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    }
  };

  const handleClose = async () => {
    if (!ticket) return;
    try {
      await api(`${apiPath}/close`, { method: "POST" });
      toast.success(t.common.success);
      setTicket({ ...ticket, status: "closed" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    }
  };

  const handleDelete = async () => {
    if (!ticket || !showDelete) return;
    if (!window.confirm(t.admin.deleteConfirm)) return;
    try {
      await api(apiPath, { method: "DELETE" });
      toast.success(t.common.success);
      router.replace(backPath);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.common.error);
    }
  };

  if (loading || !ticket) {
    return (
      <div className="panel-page">
        <div className="loading"><div className="loading__spinner" /></div>
      </div>
    );
  }

  return (
    <div className="panel-page chat-page-root">
      <div className="chat-page">
        <div className="chat-page__header">
          <button type="button" className="page-back" onClick={() => router.push(backPath)}>
            <Icon name="arrow-left" size={16} />
            {backLabel}
          </button>
          <div className="chat-page__header-info">
            <h1>{ticket.subject}</h1>
            <div className="chat-page__header-meta">
              <span className={`admin-pill admin-pill--status-${ticket.status}`}>
                {ticket.status === "closed" ? t.support.closed : t.support.open}
              </span>
              {showEmail && ticket.email && (
                <span className="chat-page__header-email">{ticket.email}</span>
              )}
              {ticket.status === "open" && (
                <Button variant="ghost" size="sm" onClick={handleClose}>{closeLabel ?? t.support.close}</Button>
              )}
            </div>
          </div>
        </div>

        <div className="chat-page__messages">
          {ticket.messages.map((msg) => (
            <div key={msg.id} className={`chat-msg chat-msg--${msg.authorRole}`}>
              <div className="chat-msg__bubble">
                <p className="chat-msg__body">{msg.body}</p>
              </div>
              <span className="chat-msg__time">
                {showEmail && msg.authorRole === "admin" ? (authorLabel ?? "Support") : (showEmail ? ticket.email : "")}{" "}
                {showEmail && "· "}{new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {ticket.status === "open" ? (
          <div className="chat-page__reply">
            <textarea
              className="input input--textarea chat-page__reply-input"
              placeholder={replyPlaceholder ?? t.support.messagePlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button disabled={!text.trim() || sending} onClick={handleSend}>
              {sending ? <div className="spinner" /> : <Icon name="arrow-up" size={16} />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 shrink-0 py-3">
            <Button variant="secondary" onClick={handleReopen}>{reopenLabel ?? t.support.reopen}</Button>
            {showDelete && deleteLabel && (
              <Button variant="danger" onClick={handleDelete}>{deleteLabel}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
