export function isWorkersRuntime(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["WebSocketPair"] !== "undefined") return true;
  const nav = g["navigator"] as { userAgent?: string } | undefined;
  if (nav?.userAgent === "Cloudflare-Workers") return true;
  if (
    typeof process !== "undefined" &&
    (process as { versions?: { node?: string } }).versions?.node
  ) {
    return false;
  }
  return typeof g["caches"] !== "undefined";
}
