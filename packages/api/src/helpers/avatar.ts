import type { PrismaClient } from "@neo-id/db";
import { AVATAR } from "@neo-id/shared";

const FETCH_HEADERS = {
  "User-Agent": "Neo-ID/1.0",
  Accept: "image/*",
};

export function isExternalAvatarUrl(avatar: string | null | undefined): avatar is string {
  return !!avatar && /^https?:\/\//i.test(avatar);
}

export function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function fetchExternalAvatar(url: string): Promise<{ contentType: string; buffer: Buffer } | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!AVATAR.ALLOWED_TYPES.includes(contentType as (typeof AVATAR.ALLOWED_TYPES)[number])) {
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > AVATAR.MAX_SIZE) return null;

    return { contentType, buffer };
  } catch {
    return null;
  }
}

/** Download remote avatar and store as data URL so the browser never hits Google directly. */
export async function cacheExternalAvatar(
  client: PrismaClient,
  userId: string,
  avatar: string | null | undefined,
): Promise<string | null | undefined> {
  if (!isExternalAvatarUrl(avatar)) return avatar;

  const fetched = await fetchExternalAvatar(avatar);
  if (!fetched) return avatar;

  const dataUrl = `data:${fetched.contentType};base64,${fetched.buffer.toString("base64")}`;

  await client.user.update({
    where: { id: userId },
    data: { avatar: dataUrl },
  });

  return dataUrl;
}

export async function resolveAvatarBytes(
  avatar: string | null | undefined,
): Promise<{ contentType: string; buffer: Buffer } | null> {
  if (!avatar) return null;

  if (avatar.startsWith("data:")) {
    return parseDataUrl(avatar);
  }

  if (isExternalAvatarUrl(avatar)) {
    return fetchExternalAvatar(avatar);
  }

  return null;
}

export type AvatarExt = "png" | "jpg" | "webp" | "gif";

export function sniffImageExt(buf: Uint8Array): AvatarExt | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length > 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "webp";
  if (
    buf.length > 6 &&
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  )
    return "gif";
  return null;
}

export function avatarContentType(ext: AvatarExt): string {
  if (ext === "jpg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/gif";
}

export const avatarKeyFor = (hash: string, ext: string): string => `avatars/${hash}.${ext}`;

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isAvatarKeyReferenced(client: PrismaClient, key: string): Promise<boolean> {
  const ref = await client.user.findFirst({
    where: { OR: [{ avatarKey: key }, { prevAvatarKey: key }] },
    select: { id: true },
  });
  return !!ref;
}
