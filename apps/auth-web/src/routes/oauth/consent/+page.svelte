<script lang="ts">
  import { page } from '$app/stores';
  import type { MessageKey } from '$i18n';
  import { t } from '$i18n';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { ConsentResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { notify } from '$lib/toast.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';

  const params = $derived($page.url.searchParams);
  const oauthState = $derived(params.get('state') ?? '');
  const redirectUri = $derived(params.get('redirect_uri') ?? '');
  const serviceAppId = $derived(params.get('service_app_id') ?? '');
  const scopes = $derived((params.get('scopes') ?? '').split(' ').filter(Boolean));

  let loading: 'allow' | 'deny' | null = $state(null);

  const scopeLabel: Record<string, MessageKey> = {
    openid: 'oauth.scope.openid',
    profile: 'oauth.scope.profile',
    email: 'oauth.scope.email'
  };

  async function decide(approved: boolean) {
    loading = approved ? 'allow' : 'deny';
    try {
      const { redirect: target } = fromJson(
        ConsentResponseSchema,
        await api<JsonValue>('/api/v1/oauth2/authorize/consent', {
          method: 'POST',
          body: { approved, state: oauthState, redirect_uri: redirectUri, service_app_id: serviceAppId }
        })
      );
      if (target) {
        window.location.assign(target);
        return;
      }
      window.location.assign('/');
    } catch (error) {
      notify.error(errorMessage(error));
      loading = null;
    }
  }
</script>

<AuthLayout
  title={t('oauth.consentTitle')}
  subtitle={t('oauth.consentSubtitle', { client: serviceAppId || 'neo id' })}
>
  <div class="flex flex-col gap-5">
    <p class="text-muted">{t('oauth.requestAccess')}</p>
    <ul class="flex flex-col gap-3">
      {#each scopes as scope (scope)}
        <li class="flex items-center gap-3">
          <Icon name="check" size={18} />
          <span>{scopeLabel[scope] ? t(scopeLabel[scope]) : scope}</span>
        </li>
      {/each}
    </ul>

    <div class="flex flex-col gap-3">
      <Button full loading={loading === 'allow'} disabled={loading === 'deny'} onclick={() => decide(true)}>
        {t('oauth.allow')}
      </Button>
      <Button variant="secondary" full disabled={loading !== null} onclick={() => decide(false)}>
        {t('oauth.deny')}
      </Button>
    </div>
  </div>
</AuthLayout>
