<script lang="ts">
  import '$lib/lite.css';
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { captchaMode } from '$lib/config';

  let { data } = $props();

  const redirect = $derived($page.url.searchParams.get('redirect') ?? '');

  const errorText: Record<string, string> = {
    config: 'Service is not configured',
    captcha: 'Captcha check failed, try again',
    expired: 'Code expired'
  };

  const imageSrc = $derived(
    data.captcha
      ? data.captcha.image.startsWith('data:')
        ? data.captcha.image
        : `data:image/png;base64,${data.captcha.image}`
      : ''
  );

  const pollUrl = $derived(() => {
    const params = new URLSearchParams({
      device_code: data.deviceCode,
      code: data.code,
      uri: data.uri
    });
    if (redirect) params.set('redirect', redirect);
    return `/lite/qr/poll?${params}`;
  });
</script>

<svelte:head>
  <title>NeoID</title>
  {#if data.started}
    <meta http-equiv="refresh" content={`5;url=${pollUrl()}`} />
  {/if}
  {#if captchaMode === 'altcha' && !data.started}
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
    <p class="sub">{t('qr.subtitle')}</p>

    {#if data.error}
      <p class="error">{errorText[data.error] ?? data.error}</p>
    {/if}

    {#if data.started}
      <div class="qr">
        <img src={`/qr/image?uri=${encodeURIComponent(data.uri)}`} alt="" width="240" height="240" />
        <p class="sub">{t('qr.codeLabel')}</p>
        <p class="code">{data.code}</p>
        <p class="sub">{t('qr.waiting')}</p>
      </div>
    {:else}
      <form method="POST" action="/lite/qr/start">
        {#if data.captcha}
          <div id="lite-raster" class="raster">
            <label for="captcha">{t('captcha.label')}</label>
            <img class="captcha-img" src={imageSrc} width="130" height="40" alt="" />
            <input id="captcha" name="captcha_answer" type="text" autocomplete="off" />
            <input type="hidden" name="captcha_id" value={data.captcha.id} />
            <a class="reload" href="/lite/qr" data-sveltekit-reload>{t('captcha.reload')}</a>
          </div>
        {/if}

        {#if captchaMode === 'altcha'}
          <div id="lite-altcha" class="altcha">
            <altcha-widget challenge="/api/v1/captcha/altcha" auto="onload" name="altcha"
            ></altcha-widget>
          </div>
        {/if}

        {#if redirect}<input type="hidden" name="redirect" value={redirect} />{/if}
        <button type="submit">{t('common.continue')}</button>
      </form>
    {/if}

    <p class="alt"><a href="/lite">{t('common.back')}</a></p>
  </div>
</div>
