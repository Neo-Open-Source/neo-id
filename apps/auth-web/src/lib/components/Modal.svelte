<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$i18n';
  import Icon from './Icon.svelte';

  type Props = {
    open: boolean;
    title: string;
    subtitle?: string;
    onclose?: () => void;
    children: Snippet;
  };

  let { open, title, subtitle, onclose, children }: Props = $props();

  const uid = $props.id();
  let dialog = $state<HTMLDivElement | null>(null);
  let restore: HTMLElement | null = null;

  $effect(() => {
    if (!open) return;
    restore = document.activeElement as HTMLElement | null;
    dialog?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      restore?.focus?.();
    };
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose?.();
      return;
    }
    if (event.key !== 'Tab' || !dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-end justify-center p-4 [background:color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-[6px] motion-safe:animate-[fade_200ms_ease-out] sm:items-center"
    role="presentation"
    onclick={(event) => event.target === event.currentTarget && onclose?.()}
  >
    <div
      bind:this={dialog}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      class="flex w-full max-w-[25rem] flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] outline-none motion-safe:animate-[rise_220ms_ease-out]"
    >
      <div class="relative text-center">
        <button
          type="button"
          class="icon-btn absolute right-0 top-0 -mr-1 size-9"
          onclick={() => onclose?.()}
          aria-label={t('common.close')}
        >
          <Icon name="close" size={18} />
        </button>
        <div class="flex flex-col gap-1.5 px-9">
          <h2 id={`${uid}-title`} class="text-[1.375rem] font-semibold tracking-[-0.02em]">{title}</h2>
          {#if subtitle}<p class="text-muted">{subtitle}</p>{/if}
        </div>
      </div>
      {@render children()}
    </div>
  </div>
{/if}
