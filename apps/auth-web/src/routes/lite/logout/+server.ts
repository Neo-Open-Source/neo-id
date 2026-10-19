import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

export const POST: RequestHandler = async ({ request }) => {
  const origin = upstream();
  if (!origin) redirect(303, '/lite?error=config');

  const cookie = request.headers.get('cookie');
  const res = await fetch(`${origin}/api/v1/auth/logout`, {
    method: 'POST',
    headers: cookie ? { cookie } : {}
  });

  const headers = new Headers();
  for (const cleared of res.headers.getSetCookie?.() ?? []) headers.append('set-cookie', cleared);
  headers.set('location', '/lite');
  return new Response(null, { status: 303, headers });
};
