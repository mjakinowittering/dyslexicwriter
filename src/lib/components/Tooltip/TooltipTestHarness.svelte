<script lang="ts">
    // Minimal stand-in for a real call site (ToolbarBack et al): Provider → Root →
    // Trigger(child) → Content, exercised by Tooltip.svelte.test.ts.
    import * as Tooltip from '$lib/components/Tooltip';

    import { tooltipSuppression } from '$lib/actions/tooltip-suppression.svelte';
</script>

<svelte:body use:tooltipSuppression />

<p>elsewhere</p>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <button {...props} aria-label="trigger">go</button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>the balloon</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
