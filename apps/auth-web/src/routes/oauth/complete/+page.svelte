<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  const client = $derived($page.url.searchParams.get('client') ?? 'neo id');
  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');

  onMount(() => {
    if (redirect) setTimeout(() => window.location.assign(redirect), 1200);
  });
</script>

<AuthLayout title={t('oauth.completeTitle')} subtitle={t('oauth.completeSubtitle', { client })}>
  <p class="flex items-center justify-center gap-2 text-center text-muted">
    <Spinner />
    {t('oauth.redirecting')}
  </p>
</AuthLayout>
