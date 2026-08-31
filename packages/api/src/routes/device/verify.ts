import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

export async function getDeviceCodeInfo(c: Context) {
  const code = c.req.query("code") || c.req.query("user_code");

  if (!code) {
    return error(c, "INVALID_REQUEST", "code parameter is required");
  }

  const deviceCode = await db.deviceCode.findUnique({
    where: { userCode: code.toUpperCase() },
    select: {
      userCode: true,
      status: true,
      location: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!deviceCode) {
    return error(c, "NOT_FOUND", "Invalid code", 404);
  }

  if (deviceCode.expiresAt < new Date()) {
    return error(c, "NOT_FOUND", "Code has expired", 404);
  }

  return success(c, {
    user_code: deviceCode.userCode,
    status: deviceCode.status,
    location: deviceCode.location,
    expires_at: deviceCode.expiresAt.toISOString(),
  });
}

export async function approveDeviceCode(c: Context) {
  const body = await c.req.json();
  const { user_code } = body;
  const authUser = c.get("user");

  if (!user_code) {
    return error(c, "INVALID_REQUEST", "user_code is required");
  }

  if (!authUser) {
    return error(c, "UNAUTHORIZED", "Login required", 401);
  }

  const deviceCode = await db.deviceCode.findUnique({
    where: { userCode: user_code.toUpperCase() },
  });

  if (!deviceCode) {
    return error(c, "NOT_FOUND", "Invalid code", 404);
  }

  if (deviceCode.expiresAt < new Date()) {
    return error(c, "NOT_FOUND", "Code has expired", 404);
  }

  if (deviceCode.status !== "pending") {
    return error(c, "CONFLICT", "Code already used");
  }

  // Approve
  await db.deviceCode.update({
    where: { id: deviceCode.id },
    data: {
      status: "approved",
      userId: authUser.sub,
      approvedAt: new Date(),
    },
  });

  return success(c, { ok: true });
}

export async function denyDeviceCode(c: Context) {
  const body = await c.req.json();
  const { user_code } = body;

  if (!user_code) {
    return error(c, "INVALID_REQUEST", "user_code is required");
  }

  const deviceCode = await db.deviceCode.findUnique({
    where: { userCode: user_code.toUpperCase() },
  });

  if (!deviceCode) {
    return error(c, "NOT_FOUND", "Invalid code", 404);
  }

  await db.deviceCode.update({
    where: { id: deviceCode.id },
    data: { status: "denied" },
  });

  return success(c, { ok: true });
}
