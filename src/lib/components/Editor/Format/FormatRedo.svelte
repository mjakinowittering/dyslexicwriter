<script lang="ts">
    import { Redo03Icon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatInsert from './FormatInsert.svelte';

    // Undo's pair, gated the same way — see FormatUndo. The tooltip states
    // Shift+Mod+Z; the undoRedo extension also binds Mod+Y, which is the
    // Windows habit rather than the one worth advertising.
    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().redo().run();
    };
</script>

<FormatInsert
    ariaLabel={m.content_format_redo()}
    {disabled}
    {onClick}
    shortcut={['Mod', 'Shift', 'Z']}
    tooltip={m.content_format_redo_hint()}
>
    <Icon icon={Redo03Icon} />
</FormatInsert>
