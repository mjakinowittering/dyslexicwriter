<script lang="ts">
    import { LeftToRightBlockQuoteIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().toggleBlockquote().run();
    };
</script>

<FormatToggle
    ariaLabel={m.content_format_blockquote()}
    {disabled}
    {onClick}
    shortcut={['Mod', 'Shift', 'B']}
    tooltip={m.content_format_blockquote_hint()}
    value="blockquote"
>
    <Icon icon={LeftToRightBlockQuoteIcon} />
</FormatToggle>
