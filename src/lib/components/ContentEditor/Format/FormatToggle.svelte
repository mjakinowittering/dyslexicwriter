<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Tooltip from '$lib/components/Tooltip';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    let {
        ariaLabel,
        children,
        disabled,
        onClick,
        shortcut,
        tooltip,
        value
    }: {
        ariaLabel: string;
        children: Snippet;
        disabled: boolean;
        onClick?: () => void;
        shortcut?: string[];
        tooltip: string;
        value: string;
    } = $props();
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <ToggleGroup.Item
                {...props}
                aria-label={ariaLabel}
                {disabled}
                onclick={onClick}
                {value}
            >
                {@render children()}
            </ToggleGroup.Item>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
        <span>{tooltip}</span>
        {#if shortcut}
            <span class="text-background/60">{shortcut.join('+')}</span>
        {/if}
    </Tooltip.Content>
</Tooltip.Root>
