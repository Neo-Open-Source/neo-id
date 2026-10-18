<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { api, errorMessage } from '$lib/api';
  import { notify } from '$lib/toast.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  let code = $state('');
  let loading = $state(false);
  let approved = $state(false);

  onMount(async () => {
    code = $page.url.searchParams.get('code') ?? '';
    try {
      await api('/api/v1/user/profile');
    } catch {
      const back = `/device${code ? `?code=${encodeURIComponent(code)}` : ''}`;
      await goto(`/?redirect=${encodeURIComponent(back)}`);
    }
  });

  async function approve(event: Event) {
    event.preventDefault();
    if (!code) return;
    loading = true;
    try {
      await api('/api/v1/device/approve', { method: 'POST', body: { user_code: code.trim() } });
      approved = true;
    } catch (error) {
      notify.error(errorMessage(error));
      loading = false;
    }
  }
</script>

<AuthLayout title={t('device.title')} subtitle={approved ? undefined : t('device.subtitle')}>
  {#if approved}
    <div class="flex flex-col gap-5">
      <Alert kind="success">{t('device.approvedBody')}</Alert>
      <Button href="/" full>{t('common.done')}</Button>
    </div>
  {:else}
    <form onsubmit={approve} class="stack">
      <Input
        label={t('device.codeLabel')}
        name="user_code"
        placeholder={t('device.codePlaceholder')}
        autocomplete="one-time-code"
        bind:value={code}
        required
      />
      <Button type="submit" full loading={loading} disabled={!code}>
        {t('device.approve')}
      </Button>
      <p class="text-center text-[0.8125rem] text-faint">{t('device.scanHint')}</p>
    </form>
  {/if}
</AuthLayout>
