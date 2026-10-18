<script lang="ts">
  type Props = { size?: number; class?: string };

  let { size = 34, class: className = '' }: Props = $props();

  const width = $derived(Math.round(size * (455 / 127)));
</script>

<span class="inline-flex {className}" role="img" aria-label="NeoID">
  <img
    class="logo-mark logo-mark-light"
    src="/logo-light.webp"
    alt=""
    {width}
    height={size}
    style="height:{size}px"
  />
  <img
    class="logo-mark logo-mark-dark"
    src="/logo-dark.webp"
    alt=""
    {width}
    height={size}
    style="height:{size}px"
  />
</span>
