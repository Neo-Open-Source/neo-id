<script lang="ts">
  import { page } from '$app/stores';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { RegisterStartResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { captchaMode, captchaPayload } from '$lib/config';
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

  function advance(event: Event) {
    event.preventDefault();
    if (step === 'email' && emailValid) step = 'password';
    else if (step === 'password' && isAcceptable(password) && password === confirm)
      step = 'captcha';
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
      done = true;
    } catch (error) {
      notify.error(errorMessage(error));
      captchaToken = null;
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
        <Button type="submit" full disabled={!emailValid}>{t('common.continue')}</Button>
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
          <Captcha onverify={(token) => (captchaToken = token)} />
        {/if}

        <Button type="submit" full loading={loading} disabled={!captchaReady}>
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
