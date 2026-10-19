import { env } from '$env/dynamic/public';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import {
  LoginFinishResponseSchema,
  LoginStartResponseSchema
} from '$lib/gen/auth/v1/auth_pb';
import { api } from '$lib/api';
import { captchaPayload } from '$lib/config';
import { loginFinish, loginStart } from '$lib/opaque';

export type MfaMethod = 'totp' | 'email' | 'passkey';

export function afterAuthUrl(redirect: string): string {
  if (redirect && redirect !== '/') return redirect;
  const home = env.PUBLIC_HOME_URL;
  return home && home.length > 0 ? home : '/';
}

export type MfaContext = {
  attemptId: string;
  email: string;
  methods: MfaMethod[];
  passkeyAvailable: boolean;
  emailHint: string;
  redirect: string;
};

const KEY = 'neo_mfa';

export function saveMfa(context: MfaContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(context));
  } catch {
    /* storage unavailable */
  }
}

export function loadMfa(): MfaContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MfaContext;
    return parsed?.attemptId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearMfa(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export type LoginOutcome = { mfa: true } | { mfa: false };

export async function performLogin(params: {
  email: string;
  password: string;
  captchaToken: string | null;
  redirect: string;
}): Promise<LoginOutcome> {
  const start = await loginStart(params.password);
  const started = fromJson(
    LoginStartResponseSchema,
    await api<JsonValue>('/api/v1/auth/login/start', {
      method: 'POST',
      body: {
        email: params.email,
        request: start.request,
        ...captchaPayload(params.captchaToken)
      }
    })
  );
  const finish = await loginFinish(params.password, start.state, started.response);
  const result = fromJson(
    LoginFinishResponseSchema,
    await api<JsonValue>('/api/v1/auth/login/finish', {
      method: 'POST',
      body: {
        attempt_id: started.attemptId,
        finalization: finish.finalization,
        email: params.email
      }
    }),
    { ignoreUnknownFields: true }
  );

  if (result.mfaRequired) {
    saveMfa({
      attemptId: started.attemptId,
      email: params.email,
      methods: result.mfaMethods as MfaMethod[],
      passkeyAvailable: result.passkeyAvailable ?? false,
      emailHint: result.emailHint ?? '',
      redirect: params.redirect
    });
    return { mfa: true };
  }
  return { mfa: false };
}
