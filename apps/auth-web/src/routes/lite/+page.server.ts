import { env } from '$env/dynamic/private';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { LiteCaptchaChallengeSchema } from '$lib/gen/auth/v1/captcha_pb';
import type { PageServerLoad } from './$types';

export const ssr = true;
export const csr = false;
export const prerender = false;

export const load: PageServerLoad = async () => {
  const origin = (env.AUTH_API_ORIGIN ?? '').replace(/\/$/, '');
  if (!origin) return { captcha: null };
  try {
    const res = await fetch(`${origin}/api/v1/captcha/lite`);
    if (!res.ok) return { captcha: null };
    const payload = (await res.json()) as { data?: JsonValue };
    const challenge = fromJson(LiteCaptchaChallengeSchema, payload.data ?? {}, {
      ignoreUnknownFields: true
    });
    return { captcha: { id: challenge.id, image: challenge.image } };
  } catch {
    return { captcha: null };
  }
};
