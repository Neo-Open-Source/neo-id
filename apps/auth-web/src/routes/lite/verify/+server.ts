import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

function codeBack(attempt: string, email: string, target: string): string {
  let back = `/lite/code?attempt=${encodeURIComponent(attempt)}&email=${encodeURIComponent(email)}`;
  if (target) back += `&redirect=${encodeURIComponent(target)}`;
  return back;
}

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const attempt = String(form.get('attempt') ?? '');
  const email = String(form.get('email') ?? '');
  const code = String(form.get('code') ?? '').trim();
  const target = safeRedirect(String(form.get('redirect') ?? ''));

  const origin = upstream();
  if (!origin) redirect(303, '/lite?error=config');

  const res = await fetch(`${origin}/api/v1/mfa/email/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ attempt_id: attempt, code })
  });

  if (!res.ok) redirect(303, `${codeBack(attempt, email, target)}&error=bad_code`);

  const headers = new Headers();
  for (const cookie of res.headers.getSetCookie?.() ?? []) headers.append('set-cookie', cookie);
  headers.set('location', target || '/lite');
  return new Response(null, { status: 303, headers });
};
