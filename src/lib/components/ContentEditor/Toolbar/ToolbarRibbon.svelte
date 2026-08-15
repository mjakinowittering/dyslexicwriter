<script lang="ts">
    import type { Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();
</script>

<div class="flex w-full flex-row items-center space-x-5 border-b px-5 py-2">
    {@render children()}
</div>
