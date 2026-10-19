import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string | null): string {
  if (!value) return '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

export const GET: RequestHandler = async ({ url }) => {
  const origin = upstream();
  const deviceCode = url.searchParams.get('device_code') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const uri = url.searchParams.get('uri') ?? '';
  const target = safeRedirect(url.searchParams.get('redirect'));

  if (!origin || !deviceCode) redirect(303, '/lite/qr');

  const res = await fetch(`${origin}/api/v1/device/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode })
  });

  const cookies = res.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    const headers = new Headers();
    for (const cookie of cookies) headers.append('set-cookie', cookie);
    headers.set('location', target || '/lite');
    return new Response(null, { status: 303, headers });
  }

  const payload = (await res.json().catch(() => ({}))) as { data?: { status?: string } };
  const params = new URLSearchParams({ device_code: deviceCode, code, uri });
  if (target) params.set('redirect', target);

  if (payload.data?.status === 'expired') redirect(302, `/lite/qr?error=expired`);
  redirect(302, `/lite/qr?${params}`);
};
