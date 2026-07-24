import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface PollOptions {
  ticketId: string;
  enabled?: boolean;
  apiPath?: string;
  onUpdate: (messages: unknown[]) => void;
  onStatus?: (status: string) => void;
}

export function useTicketPolling({ ticketId, enabled = true, apiPath, onUpdate, onStatus }: PollOptions) {
  const onUpdateRef = useRef(onUpdate);
  const onStatusRef = useRef(onStatus);
  onUpdateRef.current = onUpdate;
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!enabled || !ticketId) return;

    let lastId: string | null = null;
    let lastStatus: string | null = null;
    const path = apiPath || `/support/tickets/${ticketId}`;
    async function poll() {
      try {
        const data = await api<{ status?: string; messages?: Array<{ id: string }> }>(path);
        if (data.status && data.status !== lastStatus) {
          lastStatus = data.status;
          onStatusRef.current?.(data.status);
        }
        const msgs = data.messages || [];
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last.id !== lastId) {
            lastId = last.id;
            onUpdateRef.current(msgs);
          }
        }
      } catch {
        // ignore
      }
    }

    void poll();
    const interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [ticketId, enabled, apiPath]);
}
