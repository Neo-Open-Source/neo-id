<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconName } from '$lib/icons';
  import Icon from './Icon.svelte';

  type Props = { kind?: 'info' | 'success' | 'error'; children: Snippet };

  let { kind = 'info', children }: Props = $props();

  const glyphs: Record<'info' | 'success' | 'error', IconName> = {
    info: 'info',
    success: 'check',
    error: 'alert'
  };
</script>

<div
  class="flex items-start gap-3 rounded-control border bg-surface-2 p-4 {kind === 'error'
    ? 'border-line-strong'
    : 'border-line'}"
  role={kind === 'error' ? 'alert' : 'status'}
>
  <span class="mt-px inline-flex shrink-0 text-ink" aria-hidden="true">
    <Icon name={glyphs[kind]} size={18} />
  </span>
  <span class="min-w-0">{@render children()}</span>
</div>
