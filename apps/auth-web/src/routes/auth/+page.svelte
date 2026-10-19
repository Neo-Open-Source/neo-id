<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { env } from '$env/dynamic/public';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { ProfileResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { captchaMode } from '$lib/config';
  import { performLogin } from '$lib/flows';
  import { signInWithPasskey } from '$lib/passkey';
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
  let captchaRefresh = $state(0);
  let checking = $state(true);
  let signedInAs = $state<string | null>(null);

  const redirect = $derived(safeRedirect($page.url.searchParams.get('redirect'), '/'));
  const home = env.PUBLIC_HOME_URL ?? '';

  const mfaQuery = (extra: string) =>
    redirect !== '/'
      ? `${extra}${extra.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(redirect)}`
      : extra;

  function social(provider: string) {
    const dest = redirect !== '/' ? redirect : home || '/auth';
    const target = new URL(dest, location.origin).href;
    window.location.href = `/api/v1/oauth/${provider}/start?redirect=${encodeURIComponent(target)}`;
  }

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

  function continueToApp() {
    const dest = redirect !== '/' ? redirect : home;
    window.location.assign(dest || '/');
  }

  async function passkey() {
    loading = true;
    try {
      await signInWithPasskey({});
      const dest = redirect !== '/' ? redirect : home;
      window.location.assign(dest || '/auth');
    } catch (error) {
      notify.error(errorMessage(error) || t('mfa.passkeyUnsupported'));
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
      const outcome = await performLogin({ email, password, captchaToken, redirect });
      if (outcome.mfa) {
        await goto('/2fa');
        return;
      }
      await continueToApp();
    } catch (error) {
      notify.error(errorMessage(error));
      captchaToken = null;
      captchaRefresh += 1;
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
        <Captcha onverify={(token) => (captchaToken = token)} refresh={captchaRefresh} />
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
        <Button variant="secondary" full loading={loading} onclick={passkey}>
          <Icon name="passkey" size={18} />
          {t('login.passkeyLogin')}
        </Button>
        <Button variant="secondary" full href={mfaQuery('/qr')}>
          <Icon name="qr" size={18} />
          {t('login.qr')}
        </Button>
        <div class="social-row">
          <button
            type="button"
            class="social-btn"
            aria-label={t('login.google')}
            title={t('login.google')}
            onclick={() => social('google')}
          >
            <Icon name="google" size={20} />
          </button>
          <button
            type="button"
            class="social-btn"
            aria-label={t('login.github')}
            title={t('login.github')}
            onclick={() => social('github')}
          >
            <Icon name="github" size={20} />
          </button>
        </div>
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
