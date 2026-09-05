<script lang="ts">
    import type { Editor, JSONContent } from '@tiptap/core';
    import { untrack } from 'svelte';

    import PageEditor from '$lib/components/Editor/Page/PageEditor.svelte';

    // Hands a test the one thing `rerender` cannot give it: a document that
    // arrives *after* the editor has mounted, through reactive state, exactly as
    // `doc.contentJson` reaches the real page once the file has been read from
    // disk. That is the path the seeding effect exists for.
    let {
        onTransaction,
        onUpdate,
        register
    }: {
        onTransaction?: (editor: Editor) => void;
        // The "there is writing the disk has not seen" signal. On the real page
        // this is what marks the document dirty, so a test watching it is
        // watching the one thing standing between an edit and the bin.
        onUpdate?: () => void;
        // Called once during init with a function that seeds the document.
        register: (seed: (content: JSONContent) => void) => void;
    } = $props();

    let content = $state<JSONContent | null>(null);

    const seed = (next: JSONContent) => {
        content = next;
    };

    // Handed over once, at init, on purpose: the test needs the seeder before it
    // awaits anything, and an effect would not have run by then.
    untrack(() => register(seed));
</script>

<PageEditor {content} {onTransaction} {onUpdate} />
