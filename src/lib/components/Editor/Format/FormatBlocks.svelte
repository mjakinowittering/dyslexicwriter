<script lang="ts">
    import { MinusSignIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import * as m from '$lib/paraglide/messages';

    import { applyFormat, insertHorizontalRule } from './commands';
    import { BLOCK_TOGGLES, formatToggles } from './definitions';
    import FormatMenu from './FormatMenu.svelte';
    import FormatMenuItem from './FormatMenuItem.svelte';

    // Blockquote, code block and horizontal rule. The first two are on or off
    // at the selection, and choosing the one in force takes it off; the rule is
    // an insert, below a separator, with nothing to show.
    //
    // The trigger shows the code-block glyph inside a code block and the quote
    // glyph otherwise, and looks pressed inside either.
    let {
        active,
        disabled,
        editor
    }: {
        // `doc.formatting` — which rows of `definitions.ts` are on.
        active: string[];
        disabled: boolean;
        editor: Editor | undefined;
    } = $props();

    const current = $derived(
        BLOCK_TOGGLES.find((block) => active.includes(block.value))
    );
</script>

<FormatMenu
    {disabled}
    name={m.content_format_blocks_hint()}
    pressed={current !== undefined}
    value={current?.hint()}
>
    {#snippet trigger()}
        <Icon icon={(current ?? formatToggles.blockquote).icon} />
    {/snippet}
    {#each BLOCK_TOGGLES as block (block.value)}
        <FormatMenuItem
            checked={block === current}
            icon={block.icon}
            kind="check"
            label={block.hint()}
            onSelect={() => applyFormat(editor, block)}
            shortcut={block.shortcut}
        />
    {/each}
    <DropdownMenu.Separator />
    <FormatMenuItem
        icon={MinusSignIcon}
        kind="action"
        label={m.content_format_horizontal_rule()}
        onSelect={() => insertHorizontalRule(editor)}
    />
</FormatMenu>
