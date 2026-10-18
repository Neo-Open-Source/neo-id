import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const prerender = false;

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'transfer-encoding',
  'cookie'
]);

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

export const fallback: RequestHandler = async ({ request, params, url, locals }) => {
  const origin = (locals as { authOrigin?: string }).authOrigin ?? upstream();
  if (!origin) {
    return json({ ok: false, error: { code: 'CONFIG', message: 'AUTH_API_ORIGIN is not set' } }, 500);
  }

  const path = params.path ?? '';
  const target = `${origin}/api/${path}${url.search}`;
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  }

  const init: RequestInit = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch {
    return json({ ok: false, error: { code: 'UPSTREAM', message: 'Auth backend unreachable' } }, 502);
  }

  if (path === 'v1/oauth2/authorize' && response.ok) {
    const payload = (await response.json()) as {
      data?: { consent_required?: boolean; state?: string; redirect_uri?: string; service_app_id?: string; scopes?: string[] };
    };
    const data = payload.data;
    if (data?.consent_required) {
      const consent = new URL('/oauth/consent', url.origin);
      consent.searchParams.set('state', data.state ?? '');
      consent.searchParams.set('redirect_uri', data.redirect_uri ?? '');
      consent.searchParams.set('service_app_id', data.service_app_id ?? '');
      consent.searchParams.set('scopes', (data.scopes ?? []).join(' '));
      return Response.redirect(consent, 302);
    }
    return json(payload);
  }

  if (path === 'v1/oauth2/authorize/consent' && response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) return json({ ok: true, data: { redirect: location } });
  }

  if (path === 'v1/captcha/altcha' && response.ok) {
    const payload = (await response.json()) as { data?: unknown };
    return json(payload.data ?? payload);
  }

  const out = new Headers();
  for (const [key, value] of response.headers) {
    const name = key.toLowerCase();
    if (name === 'set-cookie' || name === 'content-encoding') continue;
    out.append(key, value);
  }
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    out.append('set-cookie', cookie);
  }

  return new Response(response.body, { status: response.status, headers: out });
};
