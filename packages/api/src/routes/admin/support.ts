import type { Context } from "hono";
import type { JwtPayload } from "@neo-id/auth-core";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import { parsePagination } from "../../helpers/request";
import { emitTicketEvent } from "../../helpers/events";

function getAdmin(c: Context): JwtPayload {
  return c.get("user") as unknown as JwtPayload;
}

export async function listAllTickets(c: Context) {
  const { page, limit: limitParam, status } = c.req.query();
  const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit: limitParam }, 20);

  const where = status ? { status } : {};

  const [tickets, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        email: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    db.supportTicket.count({ where }),
  ]);

  return success(c, {
    tickets: tickets.map((t) => ({
      id: t.id,
      email: t.email,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: t._count.messages,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}

export async function getTicketDetail(c: Context) {
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });

  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  return success(c, {
    id: ticket.id,
    email: ticket.email,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    messages: ticket.messages,
  });
}

export async function replyTicket(c: Context) {
  const admin = getAdmin(c);
  const { id } = c.req.param();
  const body = await c.req.json();
  const { message } = body;

  if (!message) return error(c, "INVALID_REQUEST", "message is required");

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  if (ticket.status === "closed") return error(c, "INVALID_REQUEST", "Ticket is closed");

  const msg = await db.ticketMessage.create({
    data: {
      ticketId: id,
      authorId: admin.sub,
      authorRole: "admin",
      body: message,
    },
  });

  await db.supportTicket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "support.reply",
      targetId: id,
    },
  });

  emitTicketEvent(id, {
    id: msg.id,
    authorRole: "admin",
    body: message,
    createdAt: msg.createdAt,
  });

  return success(c, { id: msg.id });
}

export async function closeTicket(c: Context) {
  const admin = getAdmin(c);
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  await db.supportTicket.update({
    where: { id },
    data: { status: "closed" },
  });

  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "support.close",
      targetId: id,
    },
  });

  emitTicketEvent(id, { status: "closed" });

  return success(c, { closed: true });
}

export async function reopenTicket(c: Context) {
  const admin = getAdmin(c);
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  if (ticket.status !== "closed") return error(c, "INVALID_REQUEST", "Ticket is not closed");

  await db.supportTicket.update({
    where: { id },
    data: { status: "open" },
  });

  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "support.reopen",
      targetId: id,
    },
  });

  emitTicketEvent(id, { status: "open" });

  return success(c, { reopened: true });
}

export async function deleteTicket(c: Context) {
  const admin = getAdmin(c);
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  await db.supportTicket.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "support.delete",
      targetId: id,
    },
  });

  return success(c, { deleted: true });
}
