import type { Context } from "hono";
import { cacheExternalAvatar, resolveAvatarBytes } from "../../helpers/avatar";
import { cdnUrl, requestEnv } from "../../lib/cdn";
import { error } from "../../helpers/response";

const OWN_CDN_RE = /\/avatars\/[0-9a-f]{64}\.(png|jpg|jpeg|webp|gif)$/;

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "public, max-age=3600" },
  });
}

function avatarKeyFromUrl(env: { CDN_BASE?: string }, url: string): string | null {
  try {
    const base = (env.CDN_BASE ?? "").replace(/\/$/, "");
    if (!base) return null;
    const u = new URL(url);
    if (u.host !== new URL(`${base}/`).host) return null;
    const key = u.pathname.replace(/^\//, "");
    if (!key.startsWith("avatars/") || key.includes("..")) return null;
    return key;
  } catch {
    return null;
  }
}
function contentTypeForKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function sendKey(c: Context, key: string): Promise<Response> {
  const env = requestEnv(c);
  const mode = c.req.header("sec-fetch-mode");
  if (mode !== "cors" && mode !== "same-origin") return redirect(cdnUrl(env, key));
  try {
    const obj = await env.AVATARS?.get(key);
    if (obj) {
      return new Response(obj.body, {
        status: 200,
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || contentTypeForKey(key),
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  } catch {
    // fall through to redirect
  }
  return redirect(cdnUrl(env, key));
}

export async function getAvatarImage(c: Context) {
  const user = c.get("user");

  const profile = await c.get("db").user.findUnique({
    where: { id: user.sub },
    select: { avatar: true, avatarKey: true },
  });

  if (!profile?.avatar) {
    return error(c, "NOT_FOUND", "Avatar not found", 404);
  }

  const env = requestEnv(c);
  if (profile.avatarKey) {
    let live = false;
    try {
      live = !!(await env.AVATARS?.head(profile.avatarKey));
    } catch {
      live = false;
    }
    if (live) return sendKey(c, profile.avatarKey);
  }

  const avatar = profile.avatar;
  if (avatar.startsWith("http") && (profile.avatarKey || OWN_CDN_RE.test(avatar))) {
    const key = avatarKeyFromUrl(env, avatar);
    if (key) return sendKey(c, key);
    return redirect(avatar);
  }

  let resolved = avatar;

  if (/^https?:\/\//i.test(resolved)) {
    const cached = await cacheExternalAvatar(c.get("db"), user.sub, resolved);
    if (cached && cached.startsWith("data:")) {
      resolved = cached;
    }
  }

  const bytes = await resolveAvatarBytes(resolved);
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
