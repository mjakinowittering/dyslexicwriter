<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import type { FormatToggleDefinition } from './definitions';
    import FormatToggle from './FormatToggle.svelte';
    import { toggleWithWordBoundary } from './index.js';

    // Every stateful formatting control, rendered from its definition. The named
    // wrappers beside this file (`FormatToggleBold`, …) each pick one entry out
    // of `definitions.ts` and hand it here, so a control is a row in that table
    // rather than another copy of this markup.
    let {
        definition,
        disabled,
        editor
    }: {
        definition: FormatToggleDefinition;
        disabled: boolean;
        editor: Editor | undefined;
    } = $props();

    function onClick() {
        if (!editor) return;

        // A mark applied with the caret inside a word takes the whole word;
        // a block toggle already acts on the block it is in.
        if (definition.wordBoundary) {
            toggleWithWordBoundary(editor, definition.run);
        } else {
            definition.run(editor.chain().focus()).run();
        }
    }
</script>

<FormatToggle
    ariaLabel={definition.label()}
    {disabled}
    {onClick}
    shortcut={definition.shortcut}
    tooltip={definition.hint()}
    value={definition.value}
>
    <Icon icon={definition.icon} />
</FormatToggle>
