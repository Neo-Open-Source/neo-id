import { api } from './api';

export type SessionUser = { id: string; email: string; role: string };

export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes('neo_id_session=1');
}

export async function logout(): Promise<void> {
  try {
    await api('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    window.location.assign('/');
  }
}

export function safeRedirect(value: string | null, fallback = '/'): string {
  if (!value) return fallback;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return fallback;
}
