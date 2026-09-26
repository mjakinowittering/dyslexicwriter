<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import { formatToggles } from './definitions';
    import FormatToggleControl from './FormatToggleControl.svelte';

    // Inline code.
    // Everything about it — icon, label, shortcut, command — is the
    // `code` row of `definitions.ts`.
    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();
</script>

<FormatToggleControl definition={formatToggles.code} {disabled} {editor} />
