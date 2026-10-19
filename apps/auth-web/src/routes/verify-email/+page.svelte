<script lang="ts">
  import { onMount } from 'svelte';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { ProfileResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import CodeInput from '$lib/components/CodeInput.svelte';

  const RESEND_SECONDS = 60;

  let email = $state('');
  let code = $state('');
  let loading = $state(false);
  let sending = $state(false);
  let cooldown = $state(RESEND_SECONDS);
  let error = $state('');
  let done = $state(false);

  onMount(() => {
    void (async () => {
      try {
        const data = fromJson(
          ProfileResponseSchema,
          await api<JsonValue>('/api/v1/user/profile')
        );
        email = data.email;
        await send();
      } catch {
        window.location.assign(`/?redirect=${encodeURIComponent('/verify-email')}`);
      }
    })();
    const timer = setInterval(() => {
      if (cooldown > 0) cooldown -= 1;
    }, 1000);
    return () => clearInterval(timer);
  });

  async function send() {
    if (sending) return;
    sending = true;
    try {
      await api('/api/v1/user/verify-email/request', { method: 'POST' });
      cooldown = RESEND_SECONDS;
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      sending = false;
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (code.length !== 6 || !email) return;
    loading = true;
    error = '';
    try {
      await api('/api/v1/user/verify-email/confirm', {
        method: 'POST',
        body: { email, code }
      });
      done = true;
    } catch (err) {
      error = errorMessage(err);
      notify.error(error);
      code = '';
      loading = false;
    }
  }
</script>

<AuthLayout
  title={t('verify.title')}
  subtitle={done ? undefined : t('verify.subtitle', { email })}
>
  {#if done}
    <Button href="/" full>{t('verify.done')}</Button>
  {:else}
    <form onsubmit={submit} class="stack">
      <CodeInput label={t('verify.codeLabel')} bind:value={code} error={error || undefined} />
      <Button type="submit" full loading={loading} disabled={code.length !== 6}>
        {t('verify.verify')}
      </Button>
    </form>
    <p class="text-center">
      <button
        type="button"
        class="font-semibold text-ink disabled:text-faint"
        onclick={send}
        disabled={cooldown > 0 || sending}
      >
        {cooldown > 0 ? t('mfa.resendIn', { seconds: cooldown }) : t('verify.resend')}
      </button>
    </p>
  {/if}
</AuthLayout>
