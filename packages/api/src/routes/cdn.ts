import { Hono } from "hono";
import { requestEnv } from "../lib/cdn";
import { error } from "../helpers/response";

export function isPublicFileKey(key: string): boolean {
  return /^avatars\/[A-Za-z0-9._/-]{1,200}$/.test(key) && !key.includes("..");
}

export const cdnRoutes = new Hono();

cdnRoutes.use("*", async (c, next) => {
  if (requestEnv(c).ENV === "prod") return error(c, "NOT_FOUND", "Not found", 404);
  await next();
});

cdnRoutes.get("/*", async (c) => {
  const key = c.req.path.replace(/^\/v1\/cdn\//, "");
  if (!isPublicFileKey(key)) return error(c, "INVALID_REQUEST", "Invalid key");
  const bucket = requestEnv(c).AVATARS;
  if (!bucket) return error(c, "NOT_FOUND", "File not found", 404);
  const obj = await bucket.get(key).catch(() => null);
  if (!obj) return error(c, "NOT_FOUND", "File not found", 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(obj.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
