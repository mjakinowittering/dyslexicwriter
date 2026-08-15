<script lang="ts">
    import { TextItalicIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';
    import { toggleWithWordBoundary } from './index.js';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();
</script>

<FormatToggle
    ariaLabel={m.content_format_italic()}
    {disabled}
    onClick={() =>
        editor && toggleWithWordBoundary(editor, (c) => c.toggleItalic())}
    shortcut={['Ctrl', 'I']}
    tooltip={m.content_format_italic_hint()}
    value="italic"
>
    <Icon icon={TextItalicIcon} />
</FormatToggle>
