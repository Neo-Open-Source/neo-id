import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken, hashToken } from "@neo-id/auth-core";
import { requireAuth } from "../../middleware/auth";
import { success, error } from "../../helpers/response";

export async function listServices(c: Context) {
  const user = c.get("user");

  const services = await db.serviceApp.findMany({
    where: { ownerId: user.sub },
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
      description: true,
      logoUrl: true,
      website: true,
      redirectUris: true,
      allowedScopes: true,
      grantTypes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return success(c, services);
}

export async function getService(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  const service = await db.serviceApp.findFirst({
    where: { id, ownerId: user.sub },
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
      description: true,
      logoUrl: true,
      website: true,
      redirectUris: true,
      allowedScopes: true,
      grantTypes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  return success(c, service);
}

export async function createService(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { name, displayName, description, logoUrl, website, redirectUris } = body;

  if (!name || !redirectUris || redirectUris.length === 0) {
    return error(c, "INVALID_REQUEST", "name and redirectUris are required");
  }

  // Generate client credentials
  const clientId = generateToken(20);
  const clientSecret = generateToken(40);
  const clientSecretHash = await hashToken(clientSecret);

  const service = await db.serviceApp.create({
    data: {
      ownerId: user.sub,
      clientId,
      clientSecretHash,
      name,
      displayName: displayName || name,
      description,
      logoUrl,
      website,
      redirectUris,
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
    },
  });

  return success(c, {
    ...service,
    client_secret: clientSecret, // Only returned on creation
  });
}

export async function updateService(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();
  const body = await c.req.json();
  const { displayName, description, logoUrl, website, redirectUris } = body;

  const service = await db.serviceApp.findFirst({
    where: { id, ownerId: user.sub },
  });

  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  const updated = await db.serviceApp.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(description !== undefined && { description }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(website !== undefined && { website }),
      ...(redirectUris !== undefined && { redirectUris }),
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
      description: true,
      logoUrl: true,
      website: true,
      redirectUris: true,
    },
  });

  return success(c, updated);
}

export async function deleteService(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  const service = await db.serviceApp.findFirst({
    where: { id, ownerId: user.sub },
  });

  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  await db.serviceApp.delete({ where: { id } });

  return success(c, { ok: true });
}

export async function rotateSecret(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  const service = await db.serviceApp.findFirst({
    where: { id, ownerId: user.sub },
  });

  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  const newSecret = generateToken(40);
  const newHash = await hashToken(newSecret);

  await db.serviceApp.update({
    where: { id },
    data: { clientSecretHash: newHash },
  });

  return success(c, { client_secret: newSecret });
}
