import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { LiteCaptchaChallengeSchema } from '$lib/gen/auth/v1/captcha_pb';
import type { PageServerLoad } from './$types';

export const ssr = true;
export const csr = false;
export const prerender = false;

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string | null): string {
  if (!value) return '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

async function signedIn(origin: string, cookie: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/v1/user/profile`, {
      headers: { cookie, accept: 'application/json' }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async ({ request, url }) => {
  const origin = upstream();
  const target = safeRedirect(url.searchParams.get('redirect'));
  const error = url.searchParams.get('error') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const deviceCode = url.searchParams.get('device_code') ?? '';
  const uri = url.searchParams.get('uri') ?? '';

  if (!origin) {
    return {
      started: false,
      code: '',
      deviceCode: '',
      uri,
      redirect: target,
      error: 'config',
      captcha: null
    };
  }

  const cookie = request.headers.get('cookie');
  if (cookie && (await signedIn(origin, cookie))) {
    redirect(303, target ? `/lite?redirect=${encodeURIComponent(target)}` : '/lite');
  }

  if (code && deviceCode && uri) {
    return { started: true, code, deviceCode, uri, redirect: target, error, captcha: null };
  }

  try {
    const res = await fetch(`${origin}/api/v1/captcha/lite`);
    if (!res.ok) {
      return { started: false, code: '', deviceCode: '', uri: '', redirect: target, error, captcha: null };
    }
    const payload = (await res.json()) as { data?: JsonValue };
    const challenge = fromJson(LiteCaptchaChallengeSchema, payload.data ?? {}, {
      ignoreUnknownFields: true
    });
    return {
      started: false,
      code: '',
      deviceCode: '',
      uri: '',
      redirect: target,
      error,
      captcha: { id: challenge.id, image: challenge.image }
    };
  } catch {
    return { started: false, code: '', deviceCode: '', uri: '', redirect: target, error, captcha: null };
  }
};
