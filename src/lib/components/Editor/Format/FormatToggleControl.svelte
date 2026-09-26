<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import { applyFormat } from './commands';
    import type { FormatToggleDefinition } from './definitions';
    import FormatToggle from './FormatToggle.svelte';

    // A stateful formatting button, rendered from its definition. The named
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

    // The same command a menu item runs for a row — see `commands.ts`.
    const onClick = () => applyFormat(editor, definition);
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
