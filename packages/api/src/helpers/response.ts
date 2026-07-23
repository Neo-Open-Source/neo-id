import type { Context } from "hono";
import { ApiError, type ApiResponse, type ErrorCode } from "@neo-id/shared";
import { generateId } from "@neo-id/auth-core";

export function success<T>(c: Context, data: T, status: 200 | 201 = 200): Response {
  const response: ApiResponse<T> = {
    ok: true,
    data,
    meta: {
      request_id: generateId(),
      timestamp: new Date().toISOString(),
    },
  };
  return c.json(response, status);
}

export function error(
  c: Context,
  code: ErrorCode,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 = 400,
  details?: Record<string, unknown>,
): Response {
  const response: ApiResponse = {
    ok: false,
    error: new ApiError(code, message, status, details),
    meta: {
      request_id: generateId(),
      timestamp: new Date().toISOString(),
    },
  };
  return c.json(response, status);
}
