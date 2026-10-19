<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { captchaMode, setCaptchaFallback, turnstileSiteKey } from '$lib/config';
  import { t } from '$i18n';

  type Props = { onverify: (token: string | null) => void; refresh?: number };
  let { onverify, refresh = 0 }: Props = $props();

  const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const LOAD_TIMEOUT_MS = 8000;
  const ALTCHA_SCRIPT = '/api/v1/captcha/altcha.js';
  const ALTCHA_CHALLENGE = '/api/v1/captcha/altcha';

  let turnstileEl = $state<HTMLDivElement | null>(null);
  let altchaHost = $state<HTMLDivElement | null>(null);
  let mode = $state<'turnstile' | 'altcha'>(captchaMode === 'altcha' ? 'altcha' : 'turnstile');
  let turnstileWidget: string | null = null;
  let altchaWidget: HTMLElement | null = null;

  function loadScript(src: string, marker: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-${marker}]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset[marker] = 'true';
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => reject(new Error(`${marker} script`)));
      document.head.appendChild(script);
    });
  }

  async function loadAltcha() {
    if (customElements.get('altcha-widget')) return;
    await loadScript(ALTCHA_SCRIPT, 'altcha');
    await customElements.whenDefined('altcha-widget');
  }

  async function mountAltcha() {
    if (!altchaHost || altchaWidget) return;
    try {
      await loadAltcha();
    } catch {
      onverify(null);
      return;
    }
    if (!altchaHost || altchaWidget) return;
    const el = document.createElement('altcha-widget');
    el.setAttribute('challenge', ALTCHA_CHALLENGE);
    el.setAttribute('auto', 'onload');
    el.addEventListener('verified', (event) => {
      const detail = (event as CustomEvent<{ payload?: string }>).detail;
      onverify(detail?.payload ?? null);
    });
    el.addEventListener('error', () => onverify(null));
    altchaHost.appendChild(el);
    altchaWidget = el;
  }

  function loadTurnstile(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('turnstile timeout'));
        }
      }, LOAD_TIMEOUT_MS);
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      loadScript(TURNSTILE_SCRIPT, 'turnstile').then(
        () => settle(resolve),
        () => settle(() => reject(new Error('turnstile script')))
      );
    });
  }

  function fallBack() {
    if (mode !== 'turnstile') return;
    setCaptchaFallback(true);
    mode = 'altcha';
    void mountAltcha();
  }

  function reset() {
    onverify(null);
    if (mode === 'turnstile') {
      if (turnstileWidget && window.turnstile) window.turnstile.reset(turnstileWidget);
      return;
    }
    altchaWidget?.remove();
    altchaWidget = null;
    void mountAltcha();
  }

  let seenRefresh = 0;
  $effect(() => {
    const value = refresh;
    if (value === seenRefresh) return;
    seenRefresh = value;
    if (value === 0 || captchaMode === 'off') return;
    reset();
  });

  onMount(() => {
    if (captchaMode === 'off') return;
    if (captchaMode === 'altcha') {
      void mountAltcha();
      return;
    }
    if (!turnstileSiteKey) {
      fallBack();
      return;
    }
    void (async () => {
      try {
        await loadTurnstile();
        if (!turnstileEl || !window.turnstile) throw new Error('turnstile unavailable');
        turnstileWidget = window.turnstile.render(turnstileEl, {
          sitekey: turnstileSiteKey,
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => onverify(token),
          'expired-callback': () => onverify(null),
          'error-callback': () => fallBack(),
          'timeout-callback': () => fallBack()
        });
      } catch {
        fallBack();
      }
    })();
  });

  onDestroy(() => {
    if (turnstileWidget && window.turnstile) window.turnstile.remove(turnstileWidget);
    altchaWidget?.remove();
    altchaWidget = null;
  });
</script>

{#if captchaMode !== 'off'}
  {#if mode === 'turnstile'}
    <div class="flex justify-center" bind:this={turnstileEl}></div>
  {:else}
    <div class="flex flex-col items-center gap-2">
      <div class="altcha-host" bind:this={altchaHost}></div>
      {#if captchaMode === 'turnstile'}
        <p class="text-center text-[0.75rem] text-faint">{t('captcha.fallback')}</p>
      {/if}
    </div>
  {/if}
{/if}
