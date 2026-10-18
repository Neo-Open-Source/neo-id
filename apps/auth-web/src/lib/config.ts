import { env } from '$env/dynamic/public';

export type CaptchaMode = 'off' | 'turnstile' | 'altcha';

const mode = env.PUBLIC_CAPTCHA_MODE;

export const captchaMode: CaptchaMode =
  mode === 'turnstile' || mode === 'altcha' ? mode : 'off';

export const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';

let fallbackActive = false;

export function setCaptchaFallback(active: boolean): void {
  fallbackActive = active;
}

export function isAltchaActive(): boolean {
  return captchaMode === 'altcha' || fallbackActive;
}

export function captchaPayload(token: string | null): Record<string, string> {
  if (!token) return {};
  return isAltchaActive() ? { altcha: token } : { cf_turnstile_response: token };
}
