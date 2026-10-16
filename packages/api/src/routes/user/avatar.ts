import type { Context } from "hono";
import { AVATAR } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import {
  avatarContentType,
  avatarKeyFor,
  isAvatarKeyReferenced,
  sha256Hex,
  sniffImageExt,
} from "../../helpers/avatar";
import { cdnUrl, requestEnv } from "../../lib/cdn";

export async function uploadAvatar(c: Context) {
  const user = c.get("user");

  const formData = await c.req.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return error(c, "INVALID_REQUEST", "No file provided");
  }

  if (file.size > AVATAR.MAX_SIZE) {
    return error(c, "INVALID_REQUEST", "File too large");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImageExt(bytes);
  if (!ext || bytes.length === 0) {
    return error(c, "INVALID_REQUEST", "Invalid file type");
  }

  const env = requestEnv(c);
  if (!env.AVATARS) {
    const dataUrl = `data:${avatarContentType(ext)};base64,${Buffer.from(bytes).toString("base64")}`;
    const updated = await c.get("db").user.update({
      where: { id: user.sub },
      data: { avatar: dataUrl },
      select: { avatar: true },
    });
    return success(c, { avatar: updated.avatar });
  }

  const key = avatarKeyFor(await sha256Hex(bytes), ext);
  let exists = false;
  try {
    exists = !!(await env.AVATARS.head(key));
  } catch {
    exists = false;
  }
  if (!exists) {
    await env.AVATARS.put(key, bytes, { httpMetadata: { contentType: avatarContentType(ext) } });
  }

  const current = await c.get("db").user.findUnique({
    where: { id: user.sub },
    select: { avatarKey: true, prevAvatarKey: true },
  });
  const url = cdnUrl(env, key);
  if (current?.avatarKey === key) {
    const updated = await c.get("db").user.update({
      where: { id: user.sub },
      data: { avatar: url, avatarKey: key },
      select: { avatar: true },
    });
    return success(c, { avatar: updated.avatar });
  }

  const updated = await c.get("db").user.update({
    where: { id: user.sub },
    data: { avatar: url, avatarKey: key, prevAvatarKey: current?.avatarKey ?? null },
    select: { avatar: true },
  });

  const displaced = current?.prevAvatarKey;
  if (displaced && displaced !== key && displaced !== current?.avatarKey) {
    if (!(await isAvatarKeyReferenced(c.get("db"), displaced))) {
      await env.AVATARS.delete(displaced).catch(() => {});
    }
  }

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

  const updated = await c.get("db").user.update({
    where: { id: user.sub },
    data: { avatar: `/avatars/${filename}`, avatarKey: null },
    select: { avatar: true },
  });

  return success(c, { avatar: updated.avatar });
}

export async function deleteAvatar(c: Context) {
  const user = c.get("user");

  const current = await c.get("db").user.findUnique({
    where: { id: user.sub },
    select: { avatarKey: true },
  });
  await c.get("db").user.update({
    where: { id: user.sub },
    data: { avatar: null, avatarKey: null },
  });

  const key = current?.avatarKey;
  if (key && !(await isAvatarKeyReferenced(c.get("db"), key))) {
    await requestEnv(c).AVATARS?.delete(key).catch(() => {});
  }

  return success(c, { deleted: true });
}
