import type { Context } from "hono";
import { db } from "@neo-id/db";
import { AVATAR } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function uploadAvatar(c: Context) {
  const user = c.get("user");

  const formData = await c.req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return error(c, "INVALID_REQUEST", "No file provided");
  }

  if (!(AVATAR.ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return error(c, "INVALID_REQUEST", "Invalid file type");
  }

  if (file.size > AVATAR.MAX_SIZE) {
    return error(c, "INVALID_REQUEST", "File too large");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const updated = await db.user.update({
    where: { id: user.sub },
    data: { avatar: dataUrl },
    select: { avatar: true },
  });

  return success(c, { avatar: updated.avatar });
}

export async function setStockAvatar(c: Context) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const avatarUrl = String(body.avatar_url || "").trim();

  if (!avatarUrl.startsWith("/avatars/")) {
    return error(c, "INVALID_REQUEST", "Invalid avatar");
  }

  // Only allow known stock filenames (no path traversal)
  const filename = avatarUrl.slice("/avatars/".length);
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return error(c, "INVALID_REQUEST", "Invalid avatar");
  }

  const updated = await db.user.update({
    where: { id: user.sub },
    data: { avatar: `/avatars/${filename}` },
    select: { avatar: true },
  });

  return success(c, { avatar: updated.avatar });
}

export async function deleteAvatar(c: Context) {
  const user = c.get("user");

  await db.user.update({
    where: { id: user.sub },
    data: { avatar: null },
  });

  return success(c, { deleted: true });
}
