/** Shared helper: resolve OAuth/post-login return path from query params. */
export function resolveAuthRedirect(
  redirect: string | null,
  returnTo: string | null = null,
): string {
  const raw = redirect || returnTo;
  if (!raw) return "/profile";

  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      path = `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* keep path */
  }

  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return "/profile";
}
