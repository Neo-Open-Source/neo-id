<script lang="ts">
  import { onMount } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { t } from '$i18n';
  import Icon from './Icon.svelte';

  type Props = {
    label?: string;
    value: string;
    type?: 'text' | 'email' | 'password' | 'tel';
    name?: string;
    placeholder?: string;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    required?: boolean;
    disabled?: boolean;
    error?: string;
    hint?: string;
    inputmode?: 'text' | 'email' | 'numeric';
    oninput?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  };

  let {
    label,
    value = $bindable(''),
    type = 'text',
    name,
    placeholder,
    autocomplete,
    required = false,
    disabled = false,
    error,
    hint,
    inputmode,
    oninput,
    onkeydown
  }: Props = $props();

  const uid = $props.id();
  let reveal = $state(false);
  let field = $state<HTMLDivElement | null>(null);
  let managerActive = $state(false);
  let isPassword = $derived(type === 'password');
  let resolvedType = $derived(isPassword && reveal ? 'text' : type);
  let describedBy = $derived(error ? `${uid}-error` : hint ? `${uid}-hint` : undefined);

  onMount(() => {
    const node = field;
    if (!node) return;
    const injected = () =>
      [...node.children].some((child) => !['INPUT', 'BUTTON'].includes(child.tagName));
    const check = () => {
      if (injected()) managerActive = true;
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  });
</script>

<div class="flex flex-col gap-2">
  {#if label}
    <label for={uid} class="text-[0.875rem] font-medium text-ink">
      {label}{#if required}<span class="ml-0.5 text-faint" aria-hidden="true">*</span>{/if}
    </label>
  {/if}

  <div class="relative" bind:this={field}>
    <input
      id={uid}
      bind:value
      type={resolvedType}
      {name}
      {placeholder}
      {autocomplete}
      {required}
      {disabled}
      {inputmode}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy}
      class="h-11 w-full rounded-input border bg-surface px-4 text-[0.9375rem] outline-none transition duration-150 ease-out focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)] {error
        ? 'border-danger'
        : 'border-line focus:border-fill'} {isPassword ? 'pr-11' : ''}"
      {onkeydown}
      oninput={(event) => oninput?.(event.currentTarget.value)}
    />
    {#if isPassword && !managerActive}
      <button
        type="button"
        class="absolute inset-y-0 right-2 my-auto inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-ink"
        onclick={() => (reveal = !reveal)}
        aria-label={reveal ? t('common.hidePassword') : t('common.showPassword')}
        aria-pressed={reveal}
      >
        <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
      </button>
    {/if}
  </div>

  {#if error}
    <p id={`${uid}-error`} class="text-[0.8125rem] text-danger">{error}</p>
  {:else if hint}
    <p id={`${uid}-hint`} class="text-[0.8125rem] text-muted">{hint}</p>
  {/if}
</div>
