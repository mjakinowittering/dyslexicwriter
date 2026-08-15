<script lang="ts">
    import { LeftToRightListBulletIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().toggleBulletList().run();
    };
</script>

<FormatToggle
    ariaLabel={m.content_format_bullet_list()}
    {disabled}
    {onClick}
    shortcut={['Ctrl', 'Shift', '8']}
    tooltip={m.content_format_bullet_list_hint()}
    value="bulletList"
>
    <Icon icon={LeftToRightListBulletIcon} />
</FormatToggle>
