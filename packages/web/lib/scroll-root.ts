// Scroll root helpers — on mobile the dashboard main pane scrolls instead of
// the window (locked app shell). All scroll reads/writes go through here.
// Mirrors neowatch-web/lib/state/scroll-root.ts.

export function getScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(".dashboard-main");
  if (!el) return null;
  // Only treat as scroll root when the mobile app-shell styles are active
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY === "auto" || overflowY === "scroll") return el;
  return null;
}

export function getScrollY(): number {
  const root = getScrollRoot();
  if (root) return root.scrollTop;
  return window.scrollY || document.documentElement.scrollTop;
}

export function scrollRootTo(top: number, behavior: ScrollBehavior = "auto"): void {
  const root = getScrollRoot();
  if (root) {
    root.scrollTo({ top, behavior });
    return;
  }
  window.scrollTo({ top, behavior });
}

export function onScrollRoot(handler: () => void): () => void {
  const root = getScrollRoot();
  const target: HTMLElement | Window = root ?? window;
  target.addEventListener("scroll", handler, { passive: true });
  return () => target.removeEventListener("scroll", handler);
}
