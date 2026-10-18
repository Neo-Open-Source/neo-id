<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { IconName } from '$lib/icons';
  import { t } from '$i18n';
  import { loadMfa, type MfaMethod } from '$lib/flows';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let context = $state(loadMfa());

  onMount(() => {
    if (!context) goto('/');
  });

  const options: { method: MfaMethod; href: string; label: () => string; icon: IconName }[] = [
    { method: 'totp', href: '/2fa/totp', label: () => t('mfa.totp'), icon: 'shield' },
    { method: 'email', href: '/2fa/email', label: () => t('mfa.email'), icon: 'mail' },
    { method: 'passkey', href: '/2fa/passkey', label: () => t('mfa.passkey'), icon: 'key' }
  ];
</script>

<AuthLayout title={t('mfa.title')} subtitle={context ? t('mfa.chooseMethod') : t('common.loading')}>
  {#if context}
    <div class="flex flex-col gap-3">
      {#each options as option (option.method)}
        {#if context.methods.includes(option.method)}
          <a
            class="flex h-14 items-center gap-4 rounded-control border border-line bg-surface px-4 text-[1.0625rem] font-semibold no-underline transition duration-150 ease-out hover:border-line-strong hover:bg-wash"
            href={option.href}
          >
            <span class="inline-flex text-muted"><Icon name={option.icon} size={20} /></span>
            <span class="flex-1">{option.label()}</span>
          </a>
        {/if}
      {/each}
    </div>
  {/if}
</AuthLayout>
