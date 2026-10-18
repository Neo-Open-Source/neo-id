<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { captchaMode } from '$lib/config';

  let { data } = $props();

  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');
  const error = $derived($page.url.searchParams.get('error') ?? '');

  const errorText: Record<string, string> = {
    config: 'Service is not configured',
    captcha: 'Captcha check failed, try again',
    rate: 'Too many attempts, try later',
    send_failed: 'Could not send the code',
    nomethod: 'Use the full sign-in page for this account'
  };

  const imageSrc = $derived(
    data.captcha
      ? data.captcha.image.startsWith('data:')
        ? data.captcha.image
        : `data:image/png;base64,${data.captcha.image}`
      : ''
  );

  const reloadHref = $derived(
    redirect ? `/lite?redirect=${encodeURIComponent(redirect)}` : '/lite'
  );
</script>

<svelte:head>
  <title>NeoID</title>
  <style>
    body > noscript {
      display: none !important;
    }
  </style>
  {#if captchaMode === 'altcha'}
    <script>
      (function () {
        if (!window.customElements) return;
        document.documentElement.classList.add('js-altcha');
        setTimeout(function () {
          if (!customElements.get('altcha-widget')) {
            document.documentElement.classList.remove('js-altcha');
          }
        }, 5000);
      })();
    </script>
    <script src="/api/v1/captcha/altcha.js"></script>
  {/if}
</svelte:head>

<div class="page">
  <div class="card">
    <h1>NeoID</h1>
    <p class="sub">{t('lite.subtitle')}</p>

    {#if error}
      <p class="error">{errorText[error] ?? error}</p>
    {/if}

    <form method="POST" action="/lite/start">
      <label for="email">{t('login.email')}</label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        placeholder={t('login.emailPlaceholder')}
        required
      />

      {#if data.captcha}
        <div id="lite-raster" class="raster">
          <label for="captcha">{t('captcha.label')}</label>
          <img class="captcha-img" src={imageSrc} width="130" height="40" alt="" />
          <input id="captcha" name="captcha_answer" type="text" autocomplete="off" />
          <input type="hidden" name="captcha_id" value={data.captcha.id} />
          <a class="reload" href={reloadHref} data-sveltekit-reload>{t('captcha.reload')}</a>
        </div>
      {/if}

      {#if captchaMode === 'altcha'}
        <div id="lite-altcha" class="altcha">
          <altcha-widget challenge="/api/v1/captcha/altcha" auto="onload" name="altcha"
          ></altcha-widget>
        </div>
      {/if}

      {#if redirect}<input type="hidden" name="redirect" value={redirect} />{/if}
      <button type="submit">{t('login.continue')}</button>
    </form>

    <p class="alt"><a href="/auth">{t('lite.openFull')}</a></p>
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
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font-size: 15px;
    border: 1px solid #999;
    margin-bottom: 12px;
  }
  button {
    width: 100%;
    padding: 8px;
    font-size: 15px;
  }
  .captcha-img {
    display: block;
    border: 1px solid #999;
    margin-bottom: 6px;
  }
  .reload {
    display: inline-block;
    margin-bottom: 12px;
    font-size: 12px;
  }
  .raster,
  .altcha {
    margin-bottom: 12px;
  }
  #lite-altcha {
    display: none;
  }
  :global(.js-altcha) #lite-raster {
    display: none;
  }
  :global(.js-altcha) #lite-altcha {
    display: block;
  }
  .error {
    color: #c00;
  }
  .alt {
    margin-top: 16px;
    font-size: 13px;
  }
  altcha-widget {
    display: block;
    width: 100%;
    --altcha-max-width: 100%;
  }
</style>
