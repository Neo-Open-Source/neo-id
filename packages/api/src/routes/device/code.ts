import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";

function generateUserCode(): string {
  // Generate 8-char code like "ABC-1234"
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let code = "";
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

export async function requestDeviceCode(c: Context) {
  const body = await c.req.json();
  const { client_id, scope, device_name } = body;

  if (!client_id) {
    return error(c, "INVALID_REQUEST", "client_id is required");
  }

  // Verify service app exists
  const serviceApp = await db.serviceApp.findUnique({
    where: { clientId: client_id },
    select: { id: true, isActive: true },
  });

  if (!serviceApp || !serviceApp.isActive) {
    return error(c, "INVALID_REQUEST", "Invalid client_id");
  }

  // Generate codes
  const deviceCode = generateToken(40);
  const userCode = generateUserCode();

  // Parse scopes
  const scopes = scope ? scope.split(" ") : ["openid", "profile", "email"];

  // Create device code record
  await db.deviceCode.create({
    data: {
      deviceCode,
      userCode,
      clientId: client_id,
      scopes,
      location: device_name || null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    },
  });

  const issuer = process.env.JWT_ISSUER || "https://id.neome.uk";
  const verificationUrl = `${issuer}/device?code=${userCode}`;

  return success(c, {
    device_code: deviceCode,
    user_code: userCode,
    verification_url: verificationUrl,
    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verificationUrl)}`,
    expires_in: 1800, // 30 minutes
    interval: 5,
  });
}
