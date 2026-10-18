declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }

  namespace App {
    interface Locals {}
    interface PageData {}
    interface PageState {}
    interface Platform {
      env?: {
        AUTH_API_ORIGIN?: string;
        PUBLIC_TURNSTILE_SITE_KEY?: string;
        PUBLIC_CAPTCHA_MODE?: string;
      };
      context?: unknown;
      caches?: unknown;
    }
  }
}

export {};
