"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { TicketChat } from "@/components/features/support/TicketChat";

export default function TicketDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    document.title = "Ticket — Neo ID";
  }, []);

  return (
    <TicketChat
      ticketId={id}
      apiPath={`/support/tickets/${id}`}
      replyPath={`/support/tickets/${id}/messages`}
      backPath="/support"
      backLabel={t.support.title}
      closeLabel={t.support.close}
      reopenLabel={t.support.reopen}
    />
  );
}
