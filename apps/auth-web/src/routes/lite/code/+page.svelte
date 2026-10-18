<script lang="ts">
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

<div class="page">
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

<style>
  .page {
    min-height: 100vh;
    background: #f0f0f0;
    padding: 48px 16px;
    box-sizing: border-box;
  }
  .card {
    width: 320px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #c8c8c8;
    padding: 20px 24px 24px;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
  }
  h1 {
    font-size: 20px;
    margin: 0 0 4px;
  }
  .sub {
    color: #666;
    margin: 0 0 16px;
    font-size: 13px;
  }
  label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
  }
  input[type='text'] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font-size: 18px;
    letter-spacing: 2px;
    border: 1px solid #999;
    margin-bottom: 12px;
  }
  button {
    width: 100%;
    padding: 8px;
    font-size: 15px;
  }
  .error {
    color: #c00;
  }
  .resend {
    margin-top: 12px;
  }
  .resend button {
    background: none;
    border: 0;
    padding: 0;
    color: #00c;
    text-decoration: underline;
    font-size: 13px;
  }
</style>
