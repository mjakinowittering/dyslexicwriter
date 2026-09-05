<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import { headingDefinition, type HeadingLevel } from './definitions';
    import FormatToggleControl from './FormatToggleControl.svelte';

    // One control per heading level. The level is a prop rather than four
    // components because the four differ only by number — the same reasoning
    // that put the other five controls in `definitions.ts`.
    let {
        disabled,
        editor,
        level
    }: {
        disabled: boolean;
        editor: Editor | undefined;
        level: HeadingLevel;
    } = $props();

    const definition = $derived(headingDefinition(level));
</script>

<FormatToggleControl {definition} {disabled} {editor} />
