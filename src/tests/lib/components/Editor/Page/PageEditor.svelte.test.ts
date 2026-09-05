import PageEditorHarness from '../../../../support/PageEditorHarness.svelte';
import type { Editor, JSONContent } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { CONTENT_CHECK_MS } from '$lib/components/Editor/Page/PageEditor.svelte';

// Two things this component owes the writer, both of them about not losing work.
//
// A document arrives after the editor mounts — doc.open() is async — so it is
// seeded through setContent rather than the constructor. setContent sets only
// the `preventUpdate` meta, so without `addToHistory: false` the document's own
// arrival is an undoable step: Mod+Z on a freshly opened document would replace
// it with the empty doc the editor was built with, and autosave would write
// that to disk. This is the guard for the worst bug this app can have.
//
// And an edit is not always something the editor is told about. The store marks
// itself dirty on `onUpdate` alone, and every one of its exit paths is a no-op
// on a document it believes is clean — so a change that reaches the document
// without raising that event is invisible to all of them at once. The component
// therefore checks its own content rather than trusting the event, and the rest
// of these tests are about that check firing when it should and staying quiet
// when it shouldn't.

const paragraph = (text: string): JSONContent => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

interface Seeded {
    editor: Editor;
    // Every `onUpdate` the component has raised since it mounted.
    updates: () => number;
}

// Mount empty, then hand the document over the way the page does once it has
// been read from disk.
async function seeded(content: JSONContent): Promise<Seeded> {
    let editor: Editor | undefined;
    let seed: ((content: JSONContent) => void) | undefined;
    let updates = 0;

    await render(PageEditorHarness, {
        onTransaction: (instance: Editor) => {
            editor = instance;
        },
        onUpdate: () => {
            updates += 1;
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

    return { editor: editor as Editor, updates: () => updates };
}

// Long enough for the heartbeat to have run, with room for a slow browser.
const pastTheHeartbeat = () =>
    new Promise((settle) => setTimeout(settle, CONTENT_CHECK_MS * 1.5));

describe('PageEditor', () => {
    it('does not make the document arriving an undoable step', async () => {
        const { editor } = await seeded(paragraph('The lantern room'));

        expect(editor.getText()).toContain('The lantern room');
        // Nothing to undo is what a writer sees the moment a document opens.
        expect(editor.can().undo()).toBe(false);

        editor.commands.undo();
        expect(editor.getText()).toContain('The lantern room');
    });

    it('undoes an edit back to the document, never past it', async () => {
        const { editor } = await seeded(paragraph('The lantern room'));

        editor.commands.insertContentAt(1, 'A draft of ');
        expect(editor.getText()).toContain('A draft of');
        expect(editor.can().undo()).toBe(true);

        editor.commands.undo();
        // Back to the document as it was opened — not back to an empty one.
        expect(editor.getText()).toContain('The lantern room');
        expect(editor.getText()).not.toContain('A draft of');
    });

    it('reports a change that raised no update event of its own', async () => {
        const { editor, updates } = await seeded(paragraph('The lantern room'));
        const before = updates();

        // A stand-in for the change nobody tells us about — a browser extension
        // correcting a word by rewriting the contenteditable, say. `preventUpdate`
        // is what TipTap checks before emitting `update`, so this reaches the
        // document with the event suppressed, exactly as those changes do.
        editor.view.dispatch(
            editor.state.tr
                .insertText('A draft of ', 1)
                .setMeta('preventUpdate', true)
        );

        expect(editor.getText()).toContain('A draft of');
        // Nothing yet: the event is the fast path, and it never fired.
        expect(updates()).toBe(before);

        await vi.waitFor(
            () => {
                if (updates() === before) throw new Error('never reported');
            },
            { timeout: CONTENT_CHECK_MS * 3 }
        );
    });

    it('does not report a document that has only been opened', async () => {
        const { updates } = await seeded(paragraph('The lantern room'));

        await pastTheHeartbeat();

        // Seeding is not editing. Reporting it would mark every document dirty
        // the moment it opened and write the whole folder back on load —
        // trailing paragraph, reflowed markdown and all.
        expect(updates()).toBe(0);
    });
});
