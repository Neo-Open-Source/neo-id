<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { api, errorMessage } from '$lib/api';
  import { captchaMode, captchaPayload } from '$lib/config';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Captcha from '$lib/components/Captcha.svelte';
  import Input from '$lib/components/Input.svelte';

  let email = $state($page.url.searchParams.get('email') ?? '');
  let loading = $state(false);
  let sent = $state(false);
  let captchaToken = $state<string | null>(null);

  async function submit(event: Event) {
    event.preventDefault();
    if (!email || (captchaMode !== 'off' && !captchaToken)) return;
    loading = true;
    try {
      await api('/api/v1/auth/password/forgot', {
        method: 'POST',
        body: { email, ...captchaPayload(captchaToken) }
      });
      sent = true;
    } catch (error) {
      notify.error(errorMessage(error));
      captchaToken = null;
      loading = false;
    }
  }
</script>

{#if sent}
  <AuthLayout title={t('forgot.sentTitle')} subtitle={t('forgot.sentBody', { email })}>
    <Button href="/" full>{t('forgot.backToLogin')}</Button>
  </AuthLayout>
{:else}
  <AuthLayout
    title={t('forgot.title')}
    subtitle={t('forgot.subtitle')}
    back={() => history.length > 1 && history.back()}
  >
    <form onsubmit={submit} class="stack">
      <Input
        label={t('forgot.email')}
        type="email"
        name="email"
        autocomplete="email"
        placeholder={t('login.emailPlaceholder')}
        bind:value={email}
        required
      />
      {#if captchaMode !== 'off'}
        <Captcha onverify={(token) => (captchaToken = token)} />
      {/if}
      <Button type="submit" full loading={loading} disabled={!email}>
        {t('forgot.send')}
      </Button>
    </form>
  </AuthLayout>
{/if}
