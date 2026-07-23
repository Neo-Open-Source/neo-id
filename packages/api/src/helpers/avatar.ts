import { db } from "@neo-id/db";
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
  userId: string,
  avatar: string | null | undefined,
): Promise<string | null | undefined> {
  if (!isExternalAvatarUrl(avatar)) return avatar;

  const fetched = await fetchExternalAvatar(avatar);
  if (!fetched) return avatar;

  const dataUrl = `data:${fetched.contentType};base64,${fetched.buffer.toString("base64")}`;

  await db.user.update({
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
