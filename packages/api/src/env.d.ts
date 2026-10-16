interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  readonly size: number;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
  delete(key: string | string[]): Promise<void>;
  head(key: string): Promise<unknown>;
}

interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface Env {
  AVATARS: R2Bucket;
  CDN_BASE: string;
  DATABASE_URL: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  JWT_ISSUER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  WEB_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  CORS_ORIGIN?: string;
  RP_ID?: string;
  ORIGIN?: string;
  NODE_ENV?: string;
}
