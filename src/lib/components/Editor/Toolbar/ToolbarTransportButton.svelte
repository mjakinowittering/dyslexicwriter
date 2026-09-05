<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

    // One read-aloud transport control. The same widget `FormatToggle` is for the
    // formatting row: a tooltip wrapping a toggle-group item.
    //
    // Most of these are momentary actions rather than toggles — their `value`
    // never enters the group's pressed array, so the item never lights. Play is
    // the exception and reports itself as pressed while speech is running.
    //
    // No `Tooltip.Provider` here. `ToolbarTts` provides one for the whole
    // transport, the way `Format` does for the formatting row — four providers on
    // one toolbar row was never intentional.
    let {
        label,
        hint,
        value,
        disabled = false,
        onClick,
        onPointerDown,
        children
    }: {
        label: string;
        hint: string;
        value: string;
        disabled?: boolean;
        onClick: () => void;
        // Play captures the editor's selection on pointer-down, before clicking
        // the button can collapse it.
        onPointerDown?: () => void;
        children: Snippet;
    } = $props();
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <ToggleGroup.Item
                {...props}
                aria-label={label}
                {disabled}
                onclick={onClick}
                onpointerdown={onPointerDown}
                {value}
            >
                {@render children()}
            </ToggleGroup.Item>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
        <p>{hint}</p>
    </Tooltip.Content>
</Tooltip.Root>
