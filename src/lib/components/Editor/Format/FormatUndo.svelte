<script lang="ts">
    import { Undo03Icon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatInsert from './FormatInsert.svelte';

    // Undo already works from the keyboard — StarterKit's undoRedo is enabled —
    // so this button exists for the writer who doesn't know the shortcut. Whether
    // there is anything to undo is `editor.can().undo()`, which reads ProseMirror
    // state rather than a signal, so the page computes it and passes it in
    // through `disabled`.
    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().undo().run();
    };
</script>

<FormatInsert
    ariaLabel={m.content_format_undo()}
    {disabled}
    {onClick}
    shortcut={['Mod', 'Z']}
    tooltip={m.content_format_undo_hint()}
>
    <Icon icon={Undo03Icon} />
</FormatInsert>
