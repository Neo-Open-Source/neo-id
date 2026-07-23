"use client";

import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";
import { useParams } from "next/navigation";
import { TicketChat } from "@/components/features/support/TicketChat";

export default function AdminTicketDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();

  usePageTitle("Ticket");

  return (
    <TicketChat
      ticketId={id}
      apiPath={`/admin/support/tickets/${id}`}
      replyPath={`/admin/support/tickets/${id}/reply`}
      backPath="/admin/support"
      backLabel={t.admin.supportTitle}
      showEmail
      showDelete
      authorLabel="Support"
      replyPlaceholder={t.admin.reply}
      closeLabel={t.admin.close}
      reopenLabel={t.admin.reopen}
      deleteLabel={t.admin.delete}
      currentRole="admin"
    />
  );
}
