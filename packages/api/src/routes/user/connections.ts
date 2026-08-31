import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

export async function listConnections(c: Context) {
  const user = c.get("user");

  const connections = await db.authorizedConnection.findMany({
    where: { userId: user.sub },
    select: {
      id: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      serviceApp: {
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          logoUrl: true,
          website: true,
        },
      },
    },
    orderBy: { lastUsedAt: "desc" },
  });

  return success(
    c,
    connections.map((connection) => ({
      id: connection.id,
      scopes: connection.scopes,
      createdAt: connection.createdAt,
      lastUsedAt: connection.lastUsedAt,
      app: {
        id: connection.serviceApp.id,
        name: connection.serviceApp.displayName || connection.serviceApp.name,
        description: connection.serviceApp.description,
        logoUrl: connection.serviceApp.logoUrl,
        website: connection.serviceApp.website,
      },
    })),
  );
}

export async function revokeConnection(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");

  const connection = await db.authorizedConnection.findFirst({
    where: { id, userId: user.sub },
  });

  if (!connection) {
    return error(c, "NOT_FOUND", "Connection not found", 404);
  }

  await db.authorizedConnection.delete({ where: { id: connection.id } });

  return success(c, { revoked: true });
}
