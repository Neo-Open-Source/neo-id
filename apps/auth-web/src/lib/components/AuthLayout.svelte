<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$i18n';
  import Icon from './Icon.svelte';
  import LanguagePicker from './LanguagePicker.svelte';
  import Logo from './Logo.svelte';

  type Props = {
    title: string;
    subtitle?: string;
    back?: () => void;
    backLabel?: string;
    children: Snippet;
    footer?: Snippet;
  };

  let { title, subtitle, back, backLabel, children, footer }: Props = $props();
</script>

<div class="flex min-h-svh items-start justify-center bg-app px-4 pt-8 pb-12 sm:pt-[12vh]">
  <main id="main-content" class="w-full max-w-[26rem]">
    <div
      class="relative flex flex-col gap-6 p-2 sm:rounded-card sm:border sm:border-line sm:bg-surface sm:p-8 sm:shadow-card"
    >
      {#if back}
        <button
          type="button"
          class="absolute left-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-wash hover:text-ink"
          onclick={back}
          aria-label={backLabel ?? t('common.back')}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
      {/if}

      <div class="flex flex-col items-center gap-4 text-center">
        <Logo size={34} />
        <div class="flex flex-col gap-1.5">
          <h1 class="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          {#if subtitle}<p class="text-[0.875rem] text-muted">{subtitle}</p>{/if}
        </div>
      </div>

      {@render children()}
    </div>

    <footer
      class="mt-5 flex flex-col items-center gap-3 text-center text-[0.75rem] leading-relaxed text-faint"
    >
      {#if footer}
        {@render footer()}
      {:else}
        <p>
          {t('legal.agreePrefix')}
          <a class="whitespace-nowrap font-medium text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink" href="/terms">{t('legal.terms')}</a>
          {t('legal.agreeSuffix')}
          <a class="whitespace-nowrap font-medium text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink" href="/privacy">{t('legal.privacy')}</a
          >.
        </p>
      {/if}
      <LanguagePicker />
    </footer>
  </main>
</div>
