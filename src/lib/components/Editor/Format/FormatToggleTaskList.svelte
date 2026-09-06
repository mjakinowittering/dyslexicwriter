<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import { formatToggles } from './definitions';
    import FormatToggleControl from './FormatToggleControl.svelte';

    // Task list — a list whose items carry a checkbox the writer can tick.
    // Everything about it — icon, label, shortcut, command — is the
    // `taskList` row of `definitions.ts`.
    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();
</script>

<FormatToggleControl definition={formatToggles.taskList} {disabled} {editor} />
