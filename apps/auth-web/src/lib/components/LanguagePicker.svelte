<script lang="ts">
  import { LOCALES, locale, setLocale, t, type Locale } from '$i18n';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);

  function choose(code: Locale) {
    setLocale(code);
    open = false;
  }

  function onWindowClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) open = false;
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="relative inline-flex" bind:this={root}>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold text-muted transition-colors duration-150 hover:bg-wash hover:text-ink"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={t('language.label')}
    onclick={() => (open = !open)}
  >
    <Icon name="globe" size={15} />
    <span>{locale().toUpperCase()}</span>
    <Icon
      name="chevronDown"
      size={14}
      class="opacity-60 transition-transform duration-200 {open ? 'rotate-180' : ''}"
    />
  </button>

  {#if open}
    <div
      role="listbox"
      aria-label={t('language.label')}
      class="absolute bottom-[calc(100%+8px)] left-1/2 z-50 flex min-w-[10.5rem] -translate-x-1/2 flex-col gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-dropdown"
    >
      {#each LOCALES as item (item.code)}
        <button
          type="button"
          role="option"
          aria-selected={item.code === locale()}
          class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors duration-100 {item.code ===
          locale()
            ? 'bg-surface-2 text-ink'
            : 'text-muted hover:bg-surface-2 hover:text-ink'}"
          onclick={() => choose(item.code)}
        >
          <span>{item.label}</span>
          {#if item.code === locale()}<Icon name="checkMark" size={15} />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
