<script lang="ts">
  import type { Snippet } from 'svelte';
  import Spinner from './Spinner.svelte';

  type Props = {
    variant?: 'primary' | 'secondary' | 'ghost';
    type?: 'button' | 'submit';
    loading?: boolean;
    disabled?: boolean;
    full?: boolean;
    href?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  };

  let {
    variant = 'primary',
    type = 'button',
    loading = false,
    disabled = false,
    full = false,
    href,
    onclick,
    children
  }: Props = $props();

  const variants = {
    primary: 'bg-fill text-on-fill hover:bg-fill-hover',
    secondary: 'border border-line-strong bg-surface text-ink hover:bg-wash',
    ghost: 'text-muted hover:bg-wash hover:text-ink'
  } satisfies Record<NonNullable<Props['variant']>, string>;

  let inert = $derived(disabled || loading);
  let cls = $derived(
    `inline-flex h-11 items-center justify-center gap-2 rounded-control px-5 text-[0.9375rem] font-semibold whitespace-nowrap no-underline transition duration-150 ease-out active:translate-y-px disabled:opacity-50 aria-disabled:opacity-50 ${variants[variant]}${full ? ' w-full' : ''}`
  );
</script>

{#if href}
  <a
    class={cls}
    {href}
    aria-disabled={inert}
    onclick={inert ? (event: MouseEvent) => event.preventDefault() : onclick}
  >
    {#if loading}<Spinner />{/if}
    <span class="inline-flex items-center gap-2">{@render children()}</span>
  </a>
{:else}
  <button class={cls} {type} disabled={inert} {onclick}>
    {#if loading}<Spinner />{/if}
    <span class="inline-flex items-center gap-2">{@render children()}</span>
  </button>
{/if}
