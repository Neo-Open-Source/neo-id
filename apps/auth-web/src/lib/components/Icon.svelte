<script lang="ts">
  import { icons, type IconName } from '$lib/icons';

  type Props = { name: IconName; size?: number; class?: string };

  let { name, size = 20, class: className = '' }: Props = $props();
  const body = $derived(icons[name]);
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
>{@html body}</svg>
