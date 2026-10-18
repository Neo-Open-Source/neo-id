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

  const RESEND_SECONDS = 60;

  let context = $state(loadMfa());
  let code = $state('');
  let loading = $state(false);
  let sending = $state(false);
  let error = $state('');
  let cooldown = $state(RESEND_SECONDS);

  onMount(() => {
    if (!context) {
      goto('/');
      return;
    }
    void send();
    const timer = setInterval(() => {
      if (cooldown > 0) cooldown -= 1;
    }, 1000);
    return () => clearInterval(timer);
  });

  async function send() {
    if (!context || sending || cooldown > 0) return;
    sending = true;
    try {
      await api('/api/v1/mfa/email/request', {
        method: 'POST',
        body: { attempt_id: context.attemptId }
      });
      cooldown = RESEND_SECONDS;
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      sending = false;
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!context || code.length !== 6) return;
    loading = true;
    error = '';
    try {
      await api('/api/v1/mfa/email/verify', {
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
  title={t('mfa.email')}
  subtitle={context
    ? t('mfa.emailSubtitle', { email: context.emailHint || context.email })
    : t('common.loading')}
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
    <button
      type="button"
      class="font-semibold text-ink disabled:text-faint"
      onclick={send}
      disabled={cooldown > 0 || sending}
    >
      {cooldown > 0 ? t('mfa.resendIn', { seconds: cooldown }) : t('mfa.resend')}
    </button>
  </p>
</AuthLayout>
