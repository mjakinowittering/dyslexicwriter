<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Tooltip from '$lib/components/Tooltip';

    let { children }: { children: Snippet } = $props();
</script>

<Tooltip.Provider>
    <div class="flex flex-1 flex-row items-start space-x-5">
        {@render children()}
    </div>
</Tooltip.Provider>
