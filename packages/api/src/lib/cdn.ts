import type { Context } from "hono";

export type CdnEnv = { CDN_BASE?: string };

export type R2BucketLike = {
  head(key: string): Promise<unknown>;
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
};

export type ApiEnv = CdnEnv & { AVATARS?: R2BucketLike; ENV?: string };

export function requestEnv(c: Context): ApiEnv {
  const worker = (c.env ?? {}) as ApiEnv;
  if (worker.CDN_BASE || worker.AVATARS || worker.ENV) return worker;
  const pe = typeof process !== "undefined" ? process.env : undefined;
  return { CDN_BASE: worker.CDN_BASE ?? pe?.CDN_BASE, ENV: worker.ENV ?? pe?.ENV, AVATARS: worker.AVATARS };
}

export function cdnUrl(env: CdnEnv | undefined, key: string): string {
  const base =
    env?.CDN_BASE ?? (typeof process !== "undefined" ? process.env.CDN_BASE : undefined) ?? "";
  return `${base.replace(/\/$/, "")}/${key}`;
}
