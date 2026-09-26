<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import * as m from '$lib/paraglide/messages';

    import { applyFormat } from './commands';
    import { TEXT_STYLES } from './definitions';
    import FormatMenu from './FormatMenu.svelte';
    import FormatMenuItem from './FormatMenuItem.svelte';

    // Body text or a heading level — one menu in place of four heading buttons.
    // The trigger reads the style in force ("Text", "H2"), and each item is set
    // at its own size, so the writer sees what they are choosing.
    //
    // Radio-style: exactly one style holds at a time, and choosing the one
    // already in force changes nothing.
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

    // Paragraph is on whenever no heading is, so there is always a match; the
    // fallback only covers the moment before the editor has reported at all.
    const current = $derived(
        TEXT_STYLES.find((style) => active.includes(style.definition.value)) ??
            TEXT_STYLES[0]
    );

    function onValueChange(value: string) {
        const style = TEXT_STYLES.find((s) => s.definition.value === value);
        if (style) applyFormat(editor, style.definition);
    }
</script>

<FormatMenu
    {disabled}
    name={m.content_format_text_style_hint()}
    value={current.definition.hint()}
>
    {#snippet trigger()}
        <span>{current.short()}</span>
    {/snippet}
    <DropdownMenu.RadioGroup {onValueChange} value={current.definition.value}>
        {#each TEXT_STYLES as style (style.definition.value)}
            <FormatMenuItem
                icon={style.definition.icon}
                kind="radio"
                label={style.definition.hint()}
                labelClass={style.preview}
                shortcut={style.definition.shortcut}
                value={style.definition.value}
            />
        {/each}
    </DropdownMenu.RadioGroup>
</FormatMenu>
