<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as ButtonGroup from '$lib/components/ui/button-group';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    // Two kinds of toolbar group, told apart by whether there is any state to
    // report: pass `formatting` for on/off marks and get a toggle group, omit it
    // for one-shot insert actions and get plain buttons in a button group.
    let {
        children,
        formatting = $bindable()
    }: { children: Snippet; formatting?: string[] } = $props();
</script>

{#if formatting === undefined}
    <ButtonGroup.Root>
        {@render children()}
    </ButtonGroup.Root>
{:else}
    <ToggleGroup.Root bind:value={formatting} type="multiple" variant="outline">
        {@render children()}
    </ToggleGroup.Root>
{/if}
