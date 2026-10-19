<script lang="ts">
  import '$lib/lite.css';
  import { page } from '$app/stores';
  import { t } from '$i18n';

  const attempt = $derived($page.url.searchParams.get('attempt') ?? '');
  const email = $derived($page.url.searchParams.get('email') ?? '');
  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');

  function link(path: string): string {
    const params = new URLSearchParams({ attempt, email });
    if (redirect) params.set('redirect', redirect);
    return `${path}?${params}`;
  }
</script>

<svelte:head>
  <title>NeoID</title>
</svelte:head>

<div class="page lite-root">
  <div class="card">
    <h1>NeoID</h1>
    <p class="sub">{t('mfa.chooseMethod')}</p>
    <div class="methods">
      <a href={link('/lite/totp')}>{t('mfa.totp')}</a>
      <a href={link('/lite/code')}>{t('mfa.email')}</a>
    </div>
    <p class="alt"><a href="/lite">{t('common.back')}</a></p>
  </div>
</div>
