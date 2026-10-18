<script lang="ts">
  import '../app.css';
  import Toaster from '$lib/components/Toaster.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
<Toaster />
