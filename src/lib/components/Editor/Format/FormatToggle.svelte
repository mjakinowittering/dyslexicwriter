<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import { formatShortcut } from '$lib/utils/shortcut';

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

    // `Mod` becomes ⌘ or Ctrl depending on the platform the writer is on.
    const shortcutLabel = $derived(shortcut ? formatShortcut(shortcut) : null);
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
        {#if shortcutLabel}
            <span class="text-background/60">{shortcutLabel}</span>
        {/if}
    </Tooltip.Content>
</Tooltip.Root>
