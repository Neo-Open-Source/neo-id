<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { env } from '$env/dynamic/public';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { DeviceAuthorizationResponseSchema, DeviceTokenStatusSchema } from '$lib/gen/auth/v1/device_pb';
  import { api, ApiError, errorMessage } from '$lib/api';
  import { captchaMode, captchaPayload } from '$lib/config';
  import { safeRedirect } from '$lib/session';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Captcha from '$lib/components/Captcha.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  type Phase = 'captcha' | 'loading' | 'ready' | 'approved' | 'expired' | 'error';

  const redirect = $derived(safeRedirect($page.url.searchParams.get('redirect'), '/'));
  const home = env.PUBLIC_HOME_URL ?? '';

  let phase = $state<Phase>(captchaMode === 'off' ? 'loading' : 'captcha');
  let captchaToken = $state<string | null>(null);
  let qr = $state('');
  let userCode = $state('');
  let deviceCode = $state('');
  let verificationUrl = $state('');
  let error = $state('');
  let deadline = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function start() {
    phase = 'loading';
    error = '';
    try {
      const data = fromJson(
        DeviceAuthorizationResponseSchema,
        await api<JsonValue>('/api/v1/device/authorize', {
          method: 'POST',
          body: { client_name: 'NeoID', ...captchaPayload(captchaToken) }
        })
      );
      deviceCode = data.deviceCode;
      userCode = data.userCode;
      verificationUrl = data.verificationUriComplete;
      deadline = Date.now() + data.expiresIn * 1000;
      const QRCode = (await import('qrcode')).default;
      qr = await QRCode.toDataURL(data.verificationUriComplete, {
        margin: 1,
        width: 320,
        color: { dark: '#111113', light: '#ffffff' }
      });
      phase = 'ready';
      stop();
      timer = setInterval(() => void poll(), Math.max(2, data.interval) * 1000);
    } catch (cause) {
      phase = 'error';
      error = errorMessage(cause);
    }
  }

  async function poll() {
    if (Date.now() > deadline) {
      stop();
      phase = 'expired';
      return;
    }
    try {
      const { status } = fromJson(
        DeviceTokenStatusSchema,
        await api<JsonValue>('/api/v1/device/token', {
          method: 'POST',
          body: { device_code: deviceCode }
        }),
        { ignoreUnknownFields: true }
      );
      if (status === 'pending') return;
      stop();
      if (status === 'expired') {
        phase = 'expired';
        return;
      }
      phase = 'approved';
      await finish();
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)) return;
      stop();
      phase = 'error';
      error = errorMessage(cause);
    }
  }

  function retry() {
    if (captchaMode === 'off') {
      void start();
    } else {
      captchaToken = null;
      started = false;
      phase = 'captcha';
      error = '';
    }
  }

  async function finish() {
    const dest = redirect !== '/' ? redirect : home;
    if (dest) {
      window.location.assign(dest);
      return;
    }
    await goto('/');
  }

  function backToLogin() {
    goto(redirect !== '/' ? `/?redirect=${encodeURIComponent(redirect)}` : '/');
  }

  $effect(() => {
    if (started || !(captchaMode === 'off' || captchaToken)) return;
    started = true;
    void start();
  });

  onDestroy(stop);
</script>

<AuthLayout title={t('qr.title')} subtitle={t('qr.subtitle')} back={backToLogin}>
  {#if phase === 'captcha'}
    <Captcha onverify={(token) => (captchaToken = token)} />
  {:else if phase === 'loading'}
    <p class="flex items-center justify-center py-8 text-muted" aria-live="polite"><Spinner /></p>
  {:else if phase === 'ready'}
    <div class="flex flex-col items-center gap-5">
      {#if userCode}
        <div class="flex flex-col items-center gap-1">
          <span class="text-[0.8125rem] text-muted">{t('qr.codeLabel')}</span>
          <span class="font-mono text-[1.375rem] font-semibold tracking-[0.2em]">{userCode}</span>
        </div>
      {/if}
      <img class="h-auto w-full max-w-[15rem]" src={qr} alt="" width={320} height={320} />
      <p class="flex items-center gap-2 text-[0.8125rem] text-faint" aria-live="polite">
        <Spinner />
        {t('qr.waiting')}
      </p>
      {#if verificationUrl}
        <a
          class="text-[0.8125rem] font-medium text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink"
          href={verificationUrl}
        >
          {t('qr.openDevice')}
        </a>
      {/if}
    </div>
  {:else if phase === 'approved'}
    <p class="py-8 text-center text-muted" aria-live="polite">{t('qr.approved')}</p>
  {:else if phase === 'expired'}
    <div class="flex flex-col items-center gap-4 py-4">
      <p class="text-center text-muted">{t('qr.expired')}</p>
      <button type="button" class="quiet-link font-semibold" onclick={retry}>{t('qr.retry')}</button>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-4 py-4">
      <p class="text-center text-muted" aria-live="assertive">{error}</p>
      <button type="button" class="quiet-link font-semibold" onclick={retry}>{t('common.retry')}</button>
    </div>
  {/if}

  {#if phase === 'captcha' || phase === 'ready'}
    <Button variant="secondary" full onclick={backToLogin}>{t('qr.otherMethod')}</Button>
  {/if}
</AuthLayout>
