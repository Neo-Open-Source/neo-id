import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { LiteStartResponseSchema } from '$lib/gen/auth/v1/auth_pb';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

function errorCode(code: string | undefined): string {
  switch (code) {
    case 'CAPTCHA_REQUIRED':
    case 'CAPTCHA_INVALID':
      return 'captcha';
    case 'RATE_LIMITED':
      return 'rate';
    default:
      return 'send_failed';
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const target = safeRedirect(String(form.get('redirect') ?? ''));
  const altcha = String(form.get('altcha') ?? '');
  const turnstile = String(form.get('cf-turnstile-response') ?? '');
  const captchaId = String(form.get('captcha_id') ?? '');
  const captchaAnswer = String(form.get('captcha_answer') ?? '').trim();

  const origin = upstream();
  if (!origin) redirect(303, '/lite?error=config');

  const body: Record<string, string> = { email };
  if (altcha) body.altcha = altcha;
  if (turnstile) body.cf_turnstile_response = turnstile;
  if (captchaId) body.captcha_id = captchaId;
  if (captchaAnswer) body.captcha_answer = captchaAnswer;

  const res = await fetch(`${origin}/api/v1/auth/lite/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-neo-client': 'lite' },
    body: JSON.stringify(body)
  });

  const payload = (await res.json().catch(() => ({}))) as {
    data?: JsonValue;
    error?: { code?: string };
  };
  const redirectQuery = target ? `&redirect=${encodeURIComponent(target)}` : '';

  if (!res.ok) {
    redirect(303, `/lite?error=${errorCode(payload.error?.code)}${redirectQuery}`);
  }

  const started = fromJson(LiteStartResponseSchema, payload.data ?? {}, {
    ignoreUnknownFields: true
  });
  if (!started.sent || !started.attemptId) {
    redirect(303, `/lite?error=nomethod${redirectQuery}`);
  }
  redirect(
    303,
    `/lite/code?attempt=${encodeURIComponent(started.attemptId)}&email=${encodeURIComponent(email)}${redirectQuery}`
  );
};
