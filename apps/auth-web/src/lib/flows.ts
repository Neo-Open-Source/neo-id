import { env } from '$env/dynamic/public';

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
