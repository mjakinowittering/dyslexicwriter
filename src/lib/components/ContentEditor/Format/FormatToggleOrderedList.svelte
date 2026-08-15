<script lang="ts">
    import { LeftToRightListNumberIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().toggleOrderedList().run();
    };
</script>

<FormatToggle
    ariaLabel={m.content_format_ordered_list()}
    {disabled}
    {onClick}
    shortcut={['Ctrl', 'Shift', '7']}
    tooltip={m.content_format_ordered_list_hint()}
    value="orderedList"
>
    <Icon icon={LeftToRightListNumberIcon} />
</FormatToggle>
