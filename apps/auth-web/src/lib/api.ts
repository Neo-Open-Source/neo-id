import { t } from '$i18n';
import { isAltchaActive } from './config';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: Record<string, string>;
  headers?: Record<string, string>;
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, form, headers = {} } = options;
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { accept: 'application/json', ...headers }
  };

  if (isAltchaActive()) {
    init.headers = { ...init.headers, 'x-neo-client': 'lite' };
  }

  if (form) {
    init.body = new URLSearchParams(form).toString();
    init.headers = { ...init.headers, 'content-type': 'application/x-www-form-urlencoded' };
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { ...init.headers, 'content-type': 'application/json' };
  }

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('NETWORK', t('errors.network'), 0);
  }

  const raw = await response.text();
  let payload: Envelope<T> | null = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as Envelope<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || payload?.ok === false) {
    const code = payload?.error?.code ?? 'UNKNOWN';
    const message = payload?.error?.message ?? t('errors.unknown');
    throw new ApiError(code, message, response.status);
  }

  return (payload?.data ?? (payload as unknown)) as T;
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return t('errors.unknown');
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return t('errors.invalidCredentials');
    case 'EMAIL_ALREADY_EXISTS':
      return t('errors.emailExists');
    case 'RATE_LIMITED':
      return t('errors.rateLimited');
    case 'CAPTCHA_REQUIRED':
    case 'CAPTCHA_INVALID':
      return t('errors.captcha');
    case 'NETWORK':
      return t('errors.network');
    case 'INVALID_REQUEST':
      return t('errors.unknown');
    default:
      return error.message || t('errors.unknown');
  }
}
