import type { ChainedCommands, Editor } from '@tiptap/core';

import type { FormatToggleDefinition } from './definitions';

// What the toolbar's controls actually do, in one place, so a button and a menu
// item offering the same thing run the same code.
//
// Every command starts `chain().focus()`. A toolbar click or a menu choice has
// moved focus off the editor; ProseMirror still holds the selection in its
// state, and focusing puts the caret back exactly there — so the change lands
// on what the writer had selected, and they can carry on typing.

export const getWordBoundary = (
    editor: Editor
): { from: number; to: number; word: string } | null => {
    const { state } = editor;
    const { selection } = state;
    const currentPos = selection.from;
    const resolvedPos = state.doc.resolve(currentPos);
    const textBefore = resolvedPos.parent.textContent.slice(
        0,
        resolvedPos.parentOffset
    );
    const textAfter = resolvedPos.parent.textContent.slice(
        resolvedPos.parentOffset
    );
    const wordBefore = textBefore.match(/\w*$/)?.[0] || '';
    const wordAfter = textAfter.match(/^\w*/)?.[0] || '';
    const from = currentPos - wordBefore.length;
    const to = currentPos + wordAfter.length;
    const word = wordBefore + wordAfter;

    if (!word) return null;

    return { from, to, word };
};

export const toggleWithWordBoundary = (
    editor: Editor,
    toggle: (chain: ChainedCommands) => ChainedCommands
): void => {
    const prevPos = editor.state.selection;
    const boundaries = getWordBoundary(editor);
    if (!boundaries) return;

    const from = prevPos.from === prevPos.to ? boundaries.from : prevPos.from;
    const to = prevPos.from === prevPos.to ? boundaries.to : prevPos.to;

    toggle(editor.chain().focus().setTextSelection({ from, to })).run();
    editor.commands.setTextSelection({ from: prevPos.from, to: prevPos.to });
};

// Run one row of `definitions.ts`. A mark applied with the caret inside a word
// takes the whole word; a block-level control already acts on its block.
export function applyFormat(
    editor: Editor | undefined,
    definition: FormatToggleDefinition
): void {
    if (!editor) return;

    if (definition.wordBoundary) {
        toggleWithWordBoundary(editor, definition.run);
    } else {
        definition.run(editor.chain().focus()).run();
    }
}

// A 3x3 with a header row is the shape that survives the markdown round-trip:
// GFM tables require a header.
export function insertTable(editor: Editor | undefined): void {
    editor
        ?.chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
}

export function insertHorizontalRule(editor: Editor | undefined): void {
    editor?.chain().focus().setHorizontalRule().run();
}

// The second half of inserting an image, once the file picker has answered.
// `onPick` writes the file into the document's own folder and returns the
// relative path to reference it by, or null if the write failed.
export async function insertPickedImage(
    editor: Editor | undefined,
    file: File,
    onPick: (file: File) => Promise<string | null>
): Promise<void> {
    const src = await onPick(file);
    if (src) editor?.chain().focus().setImage({ src, alt: file.name }).run();
}
