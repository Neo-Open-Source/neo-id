<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { t } from '$i18n';
  import { api, errorMessage } from '$lib/api';
  import { afterAuthUrl, clearMfa, loadMfa } from '$lib/flows';
  import { notify } from '$lib/toast.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';

  type StartResponse = { options?: unknown; publicKey?: unknown; id?: string };

  let context = $state(loadMfa());
  let email = $state('');
  let loading = $state(false);
  let failed = $state(false);

  const redirect = $derived(context?.redirect ?? afterAuthUrl('/'));

  onMount(() => {
    const fromQuery = $page.url.searchParams.get('email') ?? '';
    if (!context && !fromQuery) goto('/');
    email = context?.email ?? fromQuery;
  });

  function decode(input: string): Uint8Array<ArrayBuffer> {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function toOptions(raw: unknown): PublicKeyCredentialRequestOptions | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const allow = Array.isArray(source.allowCredentials) ? source.allowCredentials : [];
    return {
      challenge: decode(String(source.challenge ?? '')),
      rpId: typeof source.rpId === 'string' ? source.rpId : undefined,
      timeout: typeof source.timeout === 'number' ? source.timeout : undefined,
      allowCredentials: allow.map((entry) => {
        const credential = entry as Record<string, unknown>;
        return { id: decode(String(credential.id ?? '')), type: 'public-key' as const };
      })
    };
  }

  async function run() {
    loading = true;
    failed = false;
    try {
      if (!window.PublicKeyCredential) throw new Error('no webauthn');
      const body: Record<string, string> = context ? { attempt_id: context.attemptId } : { email };
      const started = await api<StartResponse>('/api/v1/passkeys/auth/start', {
        method: 'POST',
        body
      });
      const options = toOptions(started.publicKey ?? started.options);
      if (!options) throw new Error('no options');
      const assertion = (await navigator.credentials.get({
        publicKey: options
      })) as PublicKeyCredential | null;
      if (!assertion) throw new Error('cancelled');
      const response = assertion.response as AuthenticatorAssertionResponse;
      await api('/api/v1/passkeys/auth/finish', {
        method: 'POST',
        body: {
          attempt_id: context?.attemptId ?? '',
          id: assertion.id,
          client_data: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
          authenticator_data: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
          signature: btoa(String.fromCharCode(...new Uint8Array(response.signature)))
        }
      });
      clearMfa();
      window.location.assign(redirect);
    } catch (error) {
      failed = true;
      notify.error(errorMessage(error) || t('mfa.passkeyUnsupported'));
      loading = false;
    }
  }
</script>

<AuthLayout
  title={t('mfa.passkey')}
  subtitle={t('mfa.passkeySubtitle')}
  back={() => goto(context ? '/2fa' : '/')}
  backLabel={t('common.back')}
>
  <div class="flex flex-col gap-5">
    <div class="mx-auto flex size-[4.5rem] items-center justify-center rounded-3xl border border-line bg-surface text-ink">
      <Icon name="passkey" size={30} />
    </div>
    <Button full loading={loading} onclick={run}>{t('mfa.passkeyCta')}</Button>
    {#if failed}
      <Alert kind="error">{t('mfa.passkeyUnsupported')}</Alert>
      <p class="text-center">
        <a class="quiet-link" href={context ? '/2fa' : '/'}>{t('mfa.useAnother')}</a>
      </p>
    {/if}
  </div>
</AuthLayout>
