import { env } from '$env/dynamic/private';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { redirect } from '@sveltejs/kit';
import { DeviceAuthorizationResponseSchema } from '$lib/gen/auth/v1/device_pb';
import type { RequestHandler } from './$types';

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const target = safeRedirect(String(form.get('redirect') ?? ''));
  const altcha = String(form.get('altcha') ?? '');
  const turnstile = String(form.get('cf-turnstile-response') ?? '');
  const captchaId = String(form.get('captcha_id') ?? '');
  const captchaAnswer = String(form.get('captcha_answer') ?? '').trim();

  const origin = upstream();
  if (!origin) redirect(303, '/lite/qr?error=config');

  const body: Record<string, string> = { client_name: 'NeoID' };
  if (altcha) body.altcha = altcha;
  if (turnstile) body.cf_turnstile_response = turnstile;
  if (captchaId) body.captcha_id = captchaId;
  if (captchaAnswer) body.captcha_answer = captchaAnswer;

  const res = await fetch(`${origin}/api/v1/device/authorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-neo-client': 'lite' },
    body: JSON.stringify(body)
  });

  const redirectQuery = target ? `&redirect=${encodeURIComponent(target)}` : '';
  if (!res.ok) redirect(303, `/lite/qr?error=captcha${redirectQuery}`);

  const payload = (await res.json()) as { data?: JsonValue };
  const data = fromJson(DeviceAuthorizationResponseSchema, payload.data ?? {}, {
    ignoreUnknownFields: true
  });

  const params = new URLSearchParams({
    device_code: data.deviceCode,
    code: data.userCode,
    uri: data.verificationUriComplete
  });
  if (target) params.set('redirect', target);
  redirect(303, `/lite/qr?${params}`);
};
