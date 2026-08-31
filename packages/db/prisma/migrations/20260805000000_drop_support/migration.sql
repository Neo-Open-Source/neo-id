-- DropForeignKey
ALTER TABLE "ticket_messages" DROP CONSTRAINT "ticket_messages_ticketId_fkey";

-- DropTable
DROP TABLE "ticket_messages";

-- DropTable
DROP TABLE "support_tickets";
