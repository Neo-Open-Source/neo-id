<script lang="ts">
  import '$lib/lite.css';
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

  const qrHref = $derived(
    redirect ? `/lite/qr?redirect=${encodeURIComponent(redirect)}` : '/lite/qr'
  );
</script>

<svelte:head>
  <title>NeoID</title>
  {#if captchaMode === 'altcha' && !data.authed}
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

<div class="page lite-root">
  <div class="card">
    <h1>NeoID</h1>

    {#if data.authed}
      <p class="sub">{t('oauth.signedInAs', { email: data.email }) || t('login.title')}</p>
      {#if data.continueUrl}
        <a class="btn" href={data.continueUrl}>{t('common.continue')}</a>
      {/if}
      <form method="POST" action="/lite/logout" class="actions">
        <button type="submit" class="logout">{t('login.signOut')}</button>
      </form>
    {:else}
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

      <div class="alt">
        <a href="/auth">{t('lite.openFull')}</a>
        <a href={qrHref}>{t('login.qr')}</a>
      </div>
    {/if}
  </div>
</div>
