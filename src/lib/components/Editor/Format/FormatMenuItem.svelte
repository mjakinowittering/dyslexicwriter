<script lang="ts">
    import type { HugeiconsIcon } from '@hugeicons/svelte';
    import type { ComponentProps } from 'svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import { formatShortcut } from '$lib/utils/shortcut';

    // One row of a `FormatMenu`: its icon, its label, and its shortcut on the
    // right in the same form the toolbar's tooltips give it.
    //
    // `kind` is how the row behaves:
    // - `radio` — one of a set where exactly one is in force (text style). It
    //   must sit inside a `DropdownMenu.RadioGroup`, which does the choosing.
    // - `check` — on or off at the selection (a list, a quote). Choosing it runs
    //   `onSelect` every time, so choosing the one already on turns it off, the
    //   same as the toggle buttons.
    // - `action` — a one-shot insert, with no state to show.
    let {
        icon,
        label,
        shortcut,
        kind,
        value,
        checked = false,
        onSelect,
        labelClass
    }: {
        icon: ComponentProps<typeof HugeiconsIcon>['icon'];
        label: string;
        shortcut?: string[];
        kind: 'radio' | 'check' | 'action';
        // `radio` only: the key the group reports when this row is chosen.
        value?: string;
        // `check` only: whether the tick shows.
        checked?: boolean;
        onSelect?: () => void;
        // Sets the label at the size of what it makes — the text-style menu's
        // preview. A class on the label, never on the item.
        labelClass?: string;
    } = $props();

    // `Mod` becomes ⌘ or Ctrl depending on the platform the writer is on.
    const shortcutLabel = $derived(shortcut ? formatShortcut(shortcut) : null);
</script>

{#snippet row()}
    <Icon {icon} />
    <span class={labelClass}>{label}</span>
    {#if shortcutLabel}
        <DropdownMenu.Shortcut>{shortcutLabel}</DropdownMenu.Shortcut>
    {/if}
{/snippet}

{#if kind === 'radio'}
    <DropdownMenu.RadioItem value={value ?? label}>
        {@render row()}
    </DropdownMenu.RadioItem>
{:else if kind === 'check'}
    <DropdownMenu.CheckboxItem {checked} {onSelect}>
        {@render row()}
    </DropdownMenu.CheckboxItem>
{:else}
    <DropdownMenu.Item {onSelect}>
        {@render row()}
    </DropdownMenu.Item>
{/if}
