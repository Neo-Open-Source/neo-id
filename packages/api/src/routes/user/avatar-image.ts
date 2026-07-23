import type { Context } from "hono";
import { db } from "@neo-id/db";
import { cacheExternalAvatar, resolveAvatarBytes } from "../../helpers/avatar";
import { error } from "../../helpers/response";

export async function getAvatarImage(c: Context) {
  const user = c.get("user");

  const profile = await db.user.findUnique({
    where: { id: user.sub },
    select: { avatar: true },
  });

  if (!profile?.avatar) {
    return error(c, "NOT_FOUND", "Avatar not found", 404);
  }

  let avatar = profile.avatar;

  if (/^https?:\/\//i.test(avatar)) {
    const cached = await cacheExternalAvatar(user.sub, avatar);
    if (cached && cached.startsWith("data:")) {
      avatar = cached;
    }
  }

  const bytes = await resolveAvatarBytes(avatar);
  if (!bytes) {
    return error(c, "NOT_FOUND", "Avatar not found", 404);
  }

  return new Response(new Uint8Array(bytes.buffer), {
    status: 200,
    headers: {
      "Content-Type": bytes.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
