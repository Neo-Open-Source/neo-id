import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export async function uploadServiceLogo(c: Context) {
  const user = c.get("user") as { sub: string };
  const { id } = c.req.param();

  // Verify ownership
  const service = await db.serviceApp.findFirst({
    where: { id, ownerId: user.sub },
    select: { id: true },
  });

  if (!service) {
    return error(c, "NOT_FOUND", "Service not found", 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return error(c, "INVALID_REQUEST", "logo file is required");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return error(c, "INVALID_REQUEST", "Invalid file type");
  }

  if (file.size > MAX_LOGO_SIZE) {
    return error(c, "INVALID_REQUEST", "File too large (max 2MB)");
  }

  // Convert to base64 data URL (same as avatar)
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  // Update database
  await db.serviceApp.update({
    where: { id },
    data: { logoUrl: dataUrl },
  });

  return success(c, { url: dataUrl });
}
