import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const attempt = String(form.get('attempt') ?? '');
  const email = String(form.get('email') ?? '');
  const target = safeRedirect(String(form.get('redirect') ?? ''));

  const origin = upstream();
  if (!origin) redirect(303, '/lite?error=config');

  await fetch(`${origin}/api/v1/mfa/email/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ attempt_id: attempt })
  });

  let back = `/lite/code?attempt=${encodeURIComponent(attempt)}&email=${encodeURIComponent(email)}`;
  if (target) back += `&redirect=${encodeURIComponent(target)}`;
  redirect(303, back);
};
