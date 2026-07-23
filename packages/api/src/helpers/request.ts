import type { Context } from "hono";
import type { ZodSchema } from "zod";

export function getRequestInfo(c: Context) {
  const forwarded = c.req.header("X-Forwarded-For");
  return {
    deviceInfo: c.req.header("User-Agent"),
    ipAddress: forwarded?.split(",")[0]?.trim() || c.req.header("X-Real-IP") || c.req.header("CF-Connecting-IP"),
  };
}

export function validate<T>(schema: ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }
  return { success: true, data: parsed.data };
}

export function parsePagination(query: Record<string, string | undefined>, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  let limit = Math.max(1, parseInt(query.limit || String(defaultLimit), 10) || defaultLimit);
  if (limit > 100) limit = 100;
  return { page, limit, skip: (page - 1) * limit };
}
