<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { afterAuthUrl } from '$lib/flows';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';

  const age = $derived($page.url.searchParams.get('age') ?? '13');
  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');

  function confirm() {
    window.location.assign(afterAuthUrl(redirect));
  }

  function decline() {
    if (history.length > 1) history.back();
    else window.location.assign('/');
  }
</script>

<AuthLayout title={t('age.title')} subtitle={t('age.subtitle', { age })}>
  <div class="flex flex-col gap-3">
    <Button full onclick={confirm}>{t('age.confirm', { age })}</Button>
    <Button variant="secondary" full onclick={decline}>{t('age.decline')}</Button>
  </div>
</AuthLayout>
