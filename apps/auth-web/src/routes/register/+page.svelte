<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { CheckEmailResponseSchema, RegisterStartResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { captchaMode, captchaPayload } from '$lib/config';
  import { afterAuthUrl, performLogin } from '$lib/flows';
  import { registerFinish, registerStart } from '$lib/opaque';
  import { isAcceptable, passwordStrength } from '$lib/password';
  import { safeRedirect } from '$lib/session';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Captcha from '$lib/components/Captcha.svelte';
  import Input from '$lib/components/Input.svelte';

  type Step = 'email' | 'password' | 'captcha';

  let step = $state<Step>('email');
  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let loading = $state(false);
  let captchaToken = $state<string | null>(null);
  let captchaRefresh = $state(0);
  let ageOk = $state(false);
  let done = $state(false);

  const redirect = $derived(safeRedirect($page.url.searchParams.get('redirect'), '/'));
  const strength = $derived(password ? passwordStrength(password) : null);
  const mismatch = $derived(confirm.length > 0 && confirm !== password);
  const emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  const captchaReady = $derived(captchaMode === 'off' || !!captchaToken);
  const loginHref = $derived(
    redirect !== '/' ? `/?redirect=${encodeURIComponent(redirect)}` : '/'
  );

  const copy = $derived.by(() => {
    if (step === 'email') return { title: t('register.title'), subtitle: t('register.subtitle') };
    if (step === 'password')
      return { title: t('register.passwordTitle'), subtitle: t('register.passwordSubtitle') };
    return { title: t('register.verifyTitle'), subtitle: t('register.verifySubtitle') };
  });

  async function advance(event: Event) {
    event.preventDefault();
    if (step === 'password') {
      if (isAcceptable(password) && password === confirm) step = 'captcha';
      return;
    }
    if (!emailValid || loading) return;
    loading = true;
    try {
      const { available } = fromJson(
        CheckEmailResponseSchema,
        await api<JsonValue>('/api/v1/auth/register/check', {
          method: 'POST',
          body: { email: email.trim() }
        })
      );
      if (!available) {
        notify.error(t('errors.emailExists'));
        return;
      }
      step = 'password';
    } catch (error) {
      notify.error(errorMessage(error));
    } finally {
      loading = false;
    }
  }

  function back() {
    captchaToken = null;
    step = step === 'captcha' ? 'password' : 'email';
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!captchaReady || loading) return;
    loading = true;
    try {
      const address = email.trim();
      const start = await registerStart(password);
      const started = fromJson(
        RegisterStartResponseSchema,
        await api<JsonValue>('/api/v1/auth/register/start', {
          method: 'POST',
          body: { email: address, request: start.request, ...captchaPayload(captchaToken) }
        })
      );
      const upload = await registerFinish(password, start.state, started.response);
      await api('/api/v1/auth/register/finish', {
        method: 'POST',
        body: { user_id: started.userId, upload }
      });

      try {
        const outcome = await performLogin({ email: address, password, captchaToken, redirect });
        if (outcome.mfa) {
          await goto('/2fa');
          return;
        }
        window.location.assign(afterAuthUrl(redirect));
        return;
      } catch (loginError) {
        notify.error(errorMessage(loginError));
        done = true;
      }
    } catch (error) {
      notify.error(errorMessage(error));
      captchaToken = null;
      captchaRefresh += 1;
      loading = false;
    }
  }
</script>

{#if done}
  <AuthLayout title={t('register.successTitle')} subtitle={t('register.successBody', { email })}>
    <Button href={loginHref} full>{t('forgot.backToLogin')}</Button>
  </AuthLayout>
{:else}
  <AuthLayout
    title={copy.title}
    subtitle={copy.subtitle}
    back={step === 'email' ? undefined : back}
  >
    {#if step === 'email'}
      <form onsubmit={advance} class="stack">
        <Input
          label={t('register.email')}
          type="email"
          name="email"
          autocomplete="email"
          placeholder={t('login.emailPlaceholder')}
          bind:value={email}
          required
        />
        <Button type="submit" full loading={loading} disabled={!emailValid || loading}>
          {t('common.continue')}
        </Button>
      </form>
    {:else if step === 'password'}
      <form onsubmit={advance} class="stack">
        <div class="flex flex-col gap-2">
          <Input
            label={t('register.password')}
            type="password"
            name="new-password"
            autocomplete="new-password"
            placeholder={t('register.passwordPlaceholder')}
            hint={t('register.passwordHint')}
            bind:value={password}
            required
          />
          {#if strength}
            <div class="meter" data-score={strength.score}>
              <div class="meter-bars" aria-hidden="true">
                {#each [0, 1, 2, 3] as level (level)}
                  <span class:on={strength.score >= level}></span>
                {/each}
              </div>
              <span class="meter-label">{t(strength.labelKey)}</span>
            </div>
          {/if}
        </div>

        <Input
          label={t('register.confirm')}
          type="password"
          name="confirm-password"
          autocomplete="new-password"
          error={mismatch ? t('reset.mismatch') : undefined}
          bind:value={confirm}
          required
        />

        <Button type="submit" full disabled={!isAcceptable(password) || password !== confirm}>
          {t('common.continue')}
        </Button>
      </form>
    {:else}
      <form onsubmit={submit} class="stack">
        <p class="account-chip">
          <span class="account-email">{email.trim()}</span>
        </p>

        {#if captchaMode !== 'off'}
          <Captcha onverify={(token) => (captchaToken = token)} refresh={captchaRefresh} />
        {/if}

        <label class="age-check">
          <input type="checkbox" bind:checked={ageOk} required />
          <span>{t('age.confirm', { age: '16' })}</span>
        </label>

        <Button type="submit" full loading={loading} disabled={!captchaReady || !ageOk}>
          {t('register.createAccount')}
        </Button>
      </form>
    {/if}

    <p class="switch-line">
      {t('register.haveAccount')}
      <a href={loginHref}>{t('register.signIn')}</a>
    </p>
  </AuthLayout>
{/if}
