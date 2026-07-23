import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import { sendBroadcastEmail } from "../../helpers/email";

export async function listAllServices(c: Context) {
  const services = await db.serviceApp.findMany({
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
      description: true,
      logoUrl: true,
      website: true,
      isActive: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      _count: {
        select: { authorizedConnections: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(
    c,
    services.map((service) => ({
      id: service.id,
      clientId: service.clientId,
      name: service.name,
      displayName: service.displayName,
      description: service.description,
      logoUrl: service.logoUrl,
      website: service.website,
      isActive: service.isActive,
      createdAt: service.createdAt,
      owner: service.owner,
      connectionCount: service._count.authorizedConnections,
    })),
  );
}

export async function setServiceActive(c: Context) {
  const { id } = c.req.param();
  const body = await c.req.json();
  const isActive = body.isActive === true || body.isActive === "true";

  const service = await db.serviceApp.findUnique({ where: { id } });
  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  const updated = await db.serviceApp.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });

  const admin = c.get("user");
  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: isActive ? "service.enable" : "service.disable",
      targetId: id,
      details: { name: service.name },
    },
  });

  return success(c, updated);
}

export async function deleteAnyService(c: Context) {
  const { id } = c.req.param();

  const service = await db.serviceApp.findUnique({ where: { id } });
  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  await db.authorizedConnection.deleteMany({ where: { serviceAppId: id } });
  await db.serviceApp.delete({ where: { id } });

  const admin = c.get("user");
  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "service.delete",
      targetId: id,
      details: { name: service.name, clientId: service.clientId },
    },
  });

  return success(c, { deleted: true });
}

export async function sendBroadcast(c: Context) {
  const body = await c.req.json();
  const subject = String(body.subject || "").trim();
  const message = String(body.body || body.message || "").trim();
  const audience = body.audience === "all" ? "all" : body.audience === "developers" ? "developers" : "active";

  if (!subject || !message) {
    return error(c, "INVALID_REQUEST", "subject and body are required");
  }

  const where =
    audience === "all"
      ? {}
      : audience === "developers"
        ? { role: { in: ["developer", "admin"] } }
        : { status: "active" };

  const users = await db.user.findMany({
    where,
    select: { email: true },
  });

  const emails = users.map((u) => u.email).filter(Boolean);
  if (emails.length === 0) {
    return error(c, "INVALID_REQUEST", "No recipients found");
  }

  const result = await sendBroadcastEmail({
    to: emails,
    subject,
    body: message,
  });

  const admin = c.get("user");
  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "broadcast.send",
      details: { subject, audience, ...result, recipients: emails.length },
    },
  });

  return success(c, {
    recipients: emails.length,
    ...result,
  });
}
