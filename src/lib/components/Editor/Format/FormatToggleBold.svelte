<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import { formatToggles } from './definitions';
    import FormatToggleControl from './FormatToggleControl.svelte';

    // Bold.
    // Everything about it — icon, label, shortcut, command — is the
    // `bold` row of `definitions.ts`.
    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();
</script>

<FormatToggleControl definition={formatToggles.bold} {disabled} {editor} />
