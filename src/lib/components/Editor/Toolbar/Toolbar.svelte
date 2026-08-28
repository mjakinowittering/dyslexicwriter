<script lang="ts">
    import type { Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();
</script>

<nav class="flex w-full flex-row space-x-5 border-b px-5 py-3">
    {@render children()}
</nav>
