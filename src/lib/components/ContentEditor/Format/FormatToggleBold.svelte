<script lang="ts">
    import { TextBoldIcon } from '@hugeicons/core-free-icons';
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
    ariaLabel={m.content_format_bold()}
    {disabled}
    onClick={() =>
        editor && toggleWithWordBoundary(editor, (c) => c.toggleBold())}
    shortcut={['Ctrl', 'B']}
    tooltip={m.content_format_bold_hint()}
    value="bold"
>
    <Icon icon={TextBoldIcon} />
</FormatToggle>
