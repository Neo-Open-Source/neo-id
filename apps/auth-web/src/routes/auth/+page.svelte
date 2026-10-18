<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { env } from '$env/dynamic/public';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import {
    LoginFinishResponseSchema,
    LoginStartResponseSchema,
    ProfileResponseSchema
  } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { captchaMode, captchaPayload } from '$lib/config';
  import { saveMfa, type MfaMethod } from '$lib/flows';
  import { loginFinish, loginStart } from '$lib/opaque';
  import { logout, hasSessionCookie, safeRedirect } from '$lib/session';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Captcha from '$lib/components/Captcha.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Input from '$lib/components/Input.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  let email = $state('');
  let password = $state('');
  let step = $state<'email' | 'password'>('email');
  let loading = $state(false);
  let captchaToken = $state<string | null>(null);
  let checking = $state(true);
  let signedInAs = $state<string | null>(null);

  const redirect = $derived(safeRedirect($page.url.searchParams.get('redirect'), '/'));
  const home = env.PUBLIC_HOME_URL ?? '';

  const mfaQuery = (extra: string) =>
    redirect !== '/'
      ? `${extra}${extra.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(redirect)}`
      : extra;

  onMount(async () => {
    if (!hasSessionCookie()) {
      signedInAs = null;
      checking = false;
      return;
    }
    try {
      const data = fromJson(
        ProfileResponseSchema,
        await api<JsonValue>('/api/v1/user/profile')
      );
      signedInAs = data.email;
    } catch {
      signedInAs = null;
    } finally {
      checking = false;
    }
  });

  async function continueToApp() {
    const dest = redirect !== '/' ? redirect : home;
    if (dest) {
      window.location.assign(dest);
      return;
    }
    try {
      const data = fromJson(
        ProfileResponseSchema,
        await api<JsonValue>('/api/v1/user/profile')
      );
      signedInAs = data.email || email;
    } finally {
      loading = false;
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (step === 'email') {
      if (email) step = 'password';
      return;
    }
    if (captchaMode !== 'off' && !captchaToken) {
      notify.error(t('captcha.required'));
      return;
    }

    loading = true;
    try {
      const start = await loginStart(password);
      const started = fromJson(
        LoginStartResponseSchema,
        await api<JsonValue>('/api/v1/auth/login/start', {
          method: 'POST',
          body: { email, request: start.request, ...captchaPayload(captchaToken) }
        })
      );
      const finish = await loginFinish(password, start.state, started.response);
      const result = fromJson(
        LoginFinishResponseSchema,
        await api<JsonValue>('/api/v1/auth/login/finish', {
          method: 'POST',
          body: { attempt_id: started.attemptId, finalization: finish.finalization, email }
        }),
        { ignoreUnknownFields: true }
      );

      if (result.mfaRequired) {
        saveMfa({
          attemptId: started.attemptId,
          email,
          methods: result.mfaMethods as MfaMethod[],
          passkeyAvailable: result.passkeyAvailable ?? false,
          emailHint: result.emailHint ?? '',
          redirect
        });
        await goto('/2fa');
        return;
      }

      await continueToApp();
    } catch (error) {
      notify.error(errorMessage(error));
      captchaToken = null;
      loading = false;
    }
  }
</script>

{#if checking}
  <AuthLayout title={t('common.loading')}>
    <p class="flex items-center justify-center text-muted" aria-live="polite"><Spinner /></p>
  </AuthLayout>
{:else if signedInAs !== null && step === 'email' && !loading}
  <AuthLayout
    title={t('login.title')}
    subtitle={signedInAs ? t('oauth.signedInAs', { email: signedInAs }) : undefined}
  >
    <div class="flex flex-col gap-3">
      <Button full onclick={continueToApp}>{t('common.continue')}</Button>
      <Button variant="ghost" full onclick={logout}>{t('login.signOut')}</Button>
    </div>
  </AuthLayout>
{:else}
  <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
    <form onsubmit={submit} class="relative flex flex-col gap-5">
      <Input
        label={t('login.email')}
        type="email"
        name="email"
        autocomplete="email"
        placeholder={t('login.emailPlaceholder')}
        bind:value={email}
        required
      />

      {#if step === 'password'}
        <div class="motion-safe:animate-[rise_200ms_ease-out]">
          <Input
            label={t('login.password')}
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder={t('login.passwordPlaceholder')}
            bind:value={password}
            required
          />
        </div>
      {/if}

      {#if step === 'password' && captchaMode !== 'off'}
        <Captcha onverify={(token) => (captchaToken = token)} />
      {/if}

      <Button type="submit" full loading={loading} disabled={!email || (step === 'password' && !password)}>
        {step === 'email' ? t('login.continue') : t('login.signIn')}
      </Button>

      {#if step === 'password'}
        <div class="flex flex-col items-center gap-2">
          <a class="quiet-link" href={mfaQuery(`/2fa/passkey?email=${encodeURIComponent(email)}&fallback=password`)}>
            {t('login.usePasskey')}
          </a>
          <a class="quiet-link" href={mfaQuery(`/forgot-password?email=${encodeURIComponent(email)}`)}>
            {t('login.forgot')}
          </a>
        </div>
      {/if}
    </form>

    {#if step === 'email'}
      <div class="or-divider" role="separator">{t('common.or')}</div>
      <div class="flex flex-col gap-2">
        <span title={t('login.passkeySoon')}>
          <Button variant="secondary" full disabled>
            <Icon name="passkey" size={18} />
            {t('login.passkeyLogin')}
          </Button>
        </span>
        <Button variant="secondary" full href={mfaQuery('/qr')}>
          <Icon name="qr" size={18} />
          {t('login.qr')}
        </Button>
      </div>
    {/if}

    <p class="switch-line">
      {t('login.noAccount')}
      <a href={mfaQuery('/register')}>{t('login.createAccount')}</a>
    </p>

    <p class="text-center text-[0.8125rem] text-faint">
      <a class="quiet-link" href={mfaQuery('/lite')}>{t('login.lite')}</a>
    </p>
  </AuthLayout>
{/if}
