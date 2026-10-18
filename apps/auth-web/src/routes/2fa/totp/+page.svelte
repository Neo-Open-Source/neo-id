<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { t } from '$i18n';
  import { api, errorMessage } from '$lib/api';
  import { afterAuthUrl, clearMfa, loadMfa } from '$lib/flows';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import CodeInput from '$lib/components/CodeInput.svelte';

  let context = $state(loadMfa());
  let code = $state('');
  let loading = $state(false);
  let error = $state('');

  onMount(() => {
    if (!context) goto('/');
  });

  async function submit(event: Event) {
    event.preventDefault();
    if (!context || code.length !== 6) return;
    loading = true;
    error = '';
    try {
      await api('/api/v1/mfa/totp/verify', {
        method: 'POST',
        body: { attempt_id: context.attemptId, code }
      });
      clearMfa();
      window.location.assign(afterAuthUrl(context.redirect));
    } catch (err) {
      error = errorMessage(err);
      notify.error(error);
      code = '';
      loading = false;
    }
  }
</script>

<AuthLayout
  title={t('mfa.totp')}
  subtitle={t('mfa.totpSubtitle')}
  back={() => goto('/2fa')}
  backLabel={t('common.back')}
>
  <form onsubmit={submit} class="stack">
    <CodeInput label={t('mfa.code')} bind:value={code} error={error || undefined} />
    <Button type="submit" full loading={loading} disabled={code.length !== 6}>
      {t('mfa.verify')}
    </Button>
  </form>
  <p class="text-center">
    <a class="quiet-link" href="/2fa">{t('mfa.useAnother')}</a>
  </p>
</AuthLayout>
