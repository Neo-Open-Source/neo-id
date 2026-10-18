<script lang="ts">
  import type { IconName } from '$lib/icons';
  import { t } from '$i18n';
  import { dismiss, toasts, type ToastKind } from '$lib/toast.svelte';
  import Icon from './Icon.svelte';

  const glyphs: Record<ToastKind, IconName> = {
    info: 'info',
    success: 'check',
    error: 'alert'
  };
</script>

<div
  class="pointer-events-none fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
  aria-live="assertive"
>
  {#each toasts() as item (item.id)}
    <div
      class="pointer-events-auto flex items-center gap-3 rounded-control border border-line-strong bg-surface px-4 py-3 shadow-[var(--shadow)] motion-safe:animate-[rise_200ms_ease-out]"
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={glyphs[item.kind]} size={18} />
      <span class="flex-1">{item.message}</span>
      <button
        type="button"
        class="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-control-sm text-faint hover:bg-wash hover:text-ink"
        onclick={() => dismiss(item.id)}
        aria-label={t('common.close')}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  {/each}
</div>
