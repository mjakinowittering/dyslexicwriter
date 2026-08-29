import PageEditorHarness from '../../../../support/PageEditorHarness.svelte';
import type { Editor, JSONContent } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

// A document arrives after the editor mounts — doc.open() is async — so it is
// seeded through setContent rather than the constructor. setContent sets only
// the `preventUpdate` meta, so without `addToHistory: false` the document's own
// arrival is an undoable step: Mod+Z on a freshly opened document would replace
// it with the empty doc the editor was built with, and autosave would write
// that to disk. This is the guard for the worst bug this app can have.

const paragraph = (text: string): JSONContent => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

// Mount empty, then hand the document over the way the page does once it has
// been read from disk.
async function seeded(content: JSONContent): Promise<Editor> {
    let editor: Editor | undefined;
    let seed: ((content: JSONContent) => void) | undefined;

    await render(PageEditorHarness, {
        onTransaction: (instance: Editor) => {
            editor = instance;
        },
        register: (fn: (content: JSONContent) => void) => {
            seed = fn;
        }
    });

    seed?.(content);

    // The editor reports a transaction on focus too, well before the document
    // lands — so wait on the text, not on the instance.
    await vi.waitFor(() => {
        if (!editor?.getText()) throw new Error('document never seeded');
    });

    return editor as Editor;
}

describe('PageEditor', () => {
    it('does not make the document arriving an undoable step', async () => {
        const editor = await seeded(paragraph('The lantern room'));

        expect(editor.getText()).toContain('The lantern room');
        // Nothing to undo is what a writer sees the moment a document opens.
        expect(editor.can().undo()).toBe(false);

        editor.commands.undo();
        expect(editor.getText()).toContain('The lantern room');
    });

    it('undoes an edit back to the document, never past it', async () => {
        const editor = await seeded(paragraph('The lantern room'));

        editor.commands.insertContentAt(1, 'A draft of ');
        expect(editor.getText()).toContain('A draft of');
        expect(editor.can().undo()).toBe(true);

        editor.commands.undo();
        // Back to the document as it was opened — not back to an empty one.
        expect(editor.getText()).toContain('The lantern room');
        expect(editor.getText()).not.toContain('A draft of');
    });
});
