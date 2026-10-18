export type ToastKind = 'info' | 'success' | 'error';

export type ToastItem = { id: number; kind: ToastKind; message: string };

let items = $state<ToastItem[]>([]);
let seq = 0;

export function toasts(): ToastItem[] {
  return items;
}

export function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
}

export function toast(kind: ToastKind, message: string, ttl = 5200): number {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  if (typeof window !== 'undefined') setTimeout(() => dismiss(id), ttl);
  return id;
}

export const notify = {
  info: (message: string) => toast('info', message),
  success: (message: string) => toast('success', message),
  error: (message: string) => toast('error', message)
};
