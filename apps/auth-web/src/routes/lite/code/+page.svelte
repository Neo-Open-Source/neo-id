<script lang="ts">
  import '$lib/lite.css';
  import { page } from '$app/stores';
  import { t } from '$i18n';

  const attempt = $derived($page.url.searchParams.get('attempt') ?? '');
  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');
  const email = $derived($page.url.searchParams.get('email') ?? '');
  const error = $derived($page.url.searchParams.get('error') ?? '');
</script>

<svelte:head>
  <title>NeoID</title>
</svelte:head>

<div class="page lite-root">
  <div class="card">
    <h1>{t('lite.codeTitle')}</h1>
    <p class="sub">{t('lite.codeSubtitle', { email })}</p>

    {#if error}
      <p class="error">{t('errors.invalidCredentials')}</p>
    {/if}

    <form method="POST" action="/lite/verify">
      <label for="code">{t('device.codeLabel')}</label>
      <input
        id="code"
        name="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        required
      />
      <input type="hidden" name="attempt" value={attempt} />
      <input type="hidden" name="email" value={email} />
      {#if redirect}<input type="hidden" name="redirect" value={redirect} />{/if}
      <button type="submit">{t('common.continue')}</button>
    </form>

    <form method="POST" action="/lite/resend" class="resend">
      <input type="hidden" name="attempt" value={attempt} />
      <input type="hidden" name="email" value={email} />
      {#if redirect}<input type="hidden" name="redirect" value={redirect} />{/if}
      <button type="submit">{t('lite.resend')}</button>
    </form>
  </div>
</div>
