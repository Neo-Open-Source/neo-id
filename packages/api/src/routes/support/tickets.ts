import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import { emitTicketEvent } from "../../helpers/events";

function assertTicketAccess(ticket: { userId: string | null; email: string }, user: { sub: string; email: string }): void {
  if (ticket.userId && ticket.userId !== user.sub) {
    throw new Error("FORBIDDEN");
  }
  if (!ticket.userId && ticket.email !== user.email) {
    throw new Error("FORBIDDEN");
  }
}

// ─── Anonymous Ticket Helpers ─────────────────────────────────────────────────

export async function createAnonymousTicket(c: Context) {
  const body = await c.req.json();
  const { name, email, subject, message } = body;

  if (!name || !email || !subject || !message) {
    return error(c, "INVALID_REQUEST", "name, email, subject and message are required");
  }

  const ticket = await db.supportTicket.create({
    data: {
      userId: null,
      email,
      subject: `[Anonymous] ${subject}`,
      messages: {
        create: {
          authorId: null,
          authorRole: "user",
          body: `**From:** ${name} (${email})\n\n${message}`,
        },
      },
    },
  });

  return success(c, { id: ticket.id });
}

export async function getAnonymousTicket(c: Context) {
  const { id } = c.req.param();
  const email = c.req.query("email");

  if (!email) return error(c, "INVALID_REQUEST", "email query parameter is required");

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
  if (ticket.email !== email) return error(c, "FORBIDDEN", "Access denied", 403);

  return success(c, {
    id: ticket.id,
    subject: ticket.subject.replace("[Anonymous] ", ""),
    status: ticket.status,
    email: ticket.email,
    createdAt: ticket.createdAt,
    messages: ticket.messages,
  });
}

export async function addAnonymousMessage(c: Context) {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { message, email } = body;

  if (!message || !email) return error(c, "INVALID_REQUEST", "message and email are required");

  const ticket = await db.supportTicket.findUnique({ where: { id } });

  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);
  if (ticket.email !== email) return error(c, "FORBIDDEN", "Access denied", 403);
  if (ticket.status === "closed") return error(c, "INVALID_REQUEST", "Ticket is closed");

  const msg = await db.ticketMessage.create({
    data: {
      ticketId: id,
      authorId: null,
      authorRole: "user",
      body: message,
    },
  });

  await db.supportTicket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  emitTicketEvent(id, {
    id: msg.id,
    authorRole: "user",
    body: message,
    createdAt: msg.createdAt,
  });

  return success(c, { id: msg.id });
}

export async function createTicket(c: Context) {
  const user = c.get("user") as { sub: string; email?: string } | undefined;
  const body = await c.req.json();
  const { subject, message, email: anonEmail } = body;

  if (!subject || !message) {
    return error(c, "INVALID_REQUEST", "subject and message are required");
  }

  const email = user?.email || anonEmail;
  if (!email) {
    return error(c, "INVALID_REQUEST", "Email is required for anonymous tickets");
  }

  const ticket = await db.supportTicket.create({
    data: {
      userId: user?.sub || null,
      email,
      subject,
      messages: {
        create: {
          authorId: user?.sub || null,
          authorRole: "user",
          body: message,
        },
      },
    },
  });

  return success(c, { id: ticket.id });
}

export async function listMyTickets(c: Context) {
  const user = c.get("user") as { sub: string; email: string };

  const tickets = await db.supportTicket.findMany({
    where: {
      OR: [
        { userId: user.sub },
        { email: user.email },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return success(c, tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messageCount: t._count.messages,
  })));
}

export async function getTicket(c: Context) {
  const user = c.get("user") as { sub: string; email: string };
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

  try {
    assertTicketAccess(ticket, user);
  } catch {
    return error(c, "FORBIDDEN", "Access denied", 403);
  }

  return success(c, {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    messages: ticket.messages,
  });
}

export async function addMessage(c: Context) {
  const user = c.get("user") as { sub: string; email: string };
  const { id } = c.req.param();
  const body = await c.req.json();
  const { message } = body;

  if (!message) return error(c, "INVALID_REQUEST", "message is required");

  const ticket = await db.supportTicket.findUnique({ where: { id } });

  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  try {
    assertTicketAccess(ticket, user);
  } catch {
    return error(c, "FORBIDDEN", "Access denied", 403);
  }

  if (ticket.status === "closed") return error(c, "INVALID_REQUEST", "Ticket is closed");

  const msg = await db.ticketMessage.create({
    data: {
      ticketId: id,
      authorId: user.sub,
      authorRole: "user",
      body: message,
    },
  });

  await db.supportTicket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  emitTicketEvent(id, {
    id: msg.id,
    authorRole: "user",
    body: message,
    createdAt: msg.createdAt,
  });

  return success(c, { id: msg.id });
}

export async function closeMyTicket(c: Context) {
  const user = c.get("user") as { sub: string; email: string };
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  try {
    assertTicketAccess(ticket, user);
  } catch {
    return error(c, "FORBIDDEN", "Access denied", 403);
  }

  if (ticket.status !== "open") return error(c, "INVALID_REQUEST", "Ticket is not open");

  await db.supportTicket.update({
    where: { id },
    data: { status: "closed" },
  });

  return success(c, { closed: true });
}

export async function reopenMyTicket(c: Context) {
  const user = c.get("user") as { sub: string; email: string };
  const { id } = c.req.param();

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(c, "NOT_FOUND", "Ticket not found", 404);

  try {
    assertTicketAccess(ticket, user);
  } catch {
    return error(c, "FORBIDDEN", "Access denied", 403);
  }

  if (ticket.status !== "closed") return error(c, "INVALID_REQUEST", "Ticket is not closed");

  await db.supportTicket.update({
    where: { id },
    data: { status: "open" },
  });

  return success(c, { reopened: true });
}
