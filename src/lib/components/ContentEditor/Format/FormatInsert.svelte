<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Tooltip from '$lib/components/Tooltip';
    import Button from '$lib/components/ui/button/button.svelte';

    let {
        ariaLabel,
        children,
        disabled,
        onClick,
        shortcut,
        tooltip
    }: {
        ariaLabel: string;
        children: Snippet;
        disabled: boolean;
        onClick?: () => void;
        shortcut?: string[];
        tooltip: string;
    } = $props();
</script>

<!-- The insert half of the toolbar: one-shot actions, so a plain button rather
     than a ToggleGroup.Item that could never enter a pressed state. The
     transparent background matches the toggle items sitting beside it, which
     the outline button variant otherwise paints. -->
<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <Button
                {...props}
                aria-label={ariaLabel}
                {disabled}
                onclick={onClick}
                size="icon"
                variant="outline"
                class="bg-transparent dark:bg-transparent"
            >
                {@render children()}
            </Button>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
        <span>{tooltip}</span>
        {#if shortcut}
            <span class="text-background/60">{shortcut.join('+')}</span>
        {/if}
    </Tooltip.Content>
</Tooltip.Root>
