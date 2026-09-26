<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Tooltip from '$lib/components/ui/tooltip';

    let { children }: { children: Snippet } = $props();
</script>

<Tooltip.Provider>
    <div class="flex flex-1 flex-row items-center gap-1.5">
        {@render children()}
    </div>
</Tooltip.Provider>
