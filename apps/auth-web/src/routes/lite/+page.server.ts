import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { LiteCaptchaChallengeSchema } from '$lib/gen/auth/v1/captcha_pb';
import type { PageServerLoad } from './$types';

export const ssr = true;
export const csr = false;
export const prerender = false;

const upstream = () => (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');

function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

async function profileEmail(origin: string, cookie: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/api/v1/user/profile`, {
      headers: { cookie, accept: 'application/json' }
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: { email?: string } };
    return payload.data?.email ?? '';
  } catch {
    return null;
  }
}

export const load: PageServerLoad = async ({ request, url }) => {
  const origin = upstream();
  if (!origin) return { authed: false, email: '', continueUrl: null, captcha: null };

  const target = safeRedirect(url.searchParams.get('redirect'));
  const cookie = request.headers.get('cookie');
  const email = cookie ? await profileEmail(origin, cookie) : null;
  if (email !== null) {
    const home = publicEnv.PUBLIC_HOME_URL ?? '';
    return {
      authed: true,
      email,
      continueUrl: target ?? (home.length > 0 ? home : null),
      captcha: null
    };
  }

  try {
    const res = await fetch(`${origin}/api/v1/captcha/lite`);
    if (!res.ok) return { authed: false, email: '', continueUrl: null, captcha: null };
    const payload = (await res.json()) as { data?: JsonValue };
    const challenge = fromJson(LiteCaptchaChallengeSchema, payload.data ?? {}, {
      ignoreUnknownFields: true
    });
    return {
      authed: false,
      email: '',
      continueUrl: null,
      captcha: { id: challenge.id, image: challenge.image }
    };
  } catch {
    return { authed: false, email: '', continueUrl: null, captcha: null };
  }
};
