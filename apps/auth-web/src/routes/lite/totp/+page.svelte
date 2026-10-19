<script lang="ts">
  import '$lib/lite.css';
  import { page } from '$app/stores';
  import { t } from '$i18n';

  const attempt = $derived($page.url.searchParams.get('attempt') ?? '');
  const email = $derived($page.url.searchParams.get('email') ?? '');
  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');
  const error = $derived($page.url.searchParams.get('error') ?? '');

  const other = $derived(() => {
    const params = new URLSearchParams({ attempt, email });
    if (redirect) params.set('redirect', redirect);
    return `/lite/2fa?${params}`;
  });
</script>

<svelte:head>
  <title>NeoID</title>
</svelte:head>

<div class="page lite-root">
  <div class="card">
    <h1>NeoID</h1>
    <p class="sub">{t('mfa.totpSubtitle')}</p>

    {#if error}
      <p class="error">{t('errors.invalidCredentials')}</p>
    {/if}

    <form method="POST" action="/lite/totp/verify">
      <label for="code">{t('mfa.code')}</label>
      <input
        id="code"
        name="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        required
      />
      <input type="hidden" name="attempt" value={attempt} />
      <input type="hidden" name="email" value={email} />
      {#if redirect}<input type="hidden" name="redirect" value={redirect} />{/if}
      <button type="submit">{t('mfa.verify')}</button>
    </form>

    <p class="alt"><a href={other()}>{t('mfa.useAnother')}</a></p>
  </div>
</div>
