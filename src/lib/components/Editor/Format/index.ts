import type { ChainedCommands, Editor } from '@tiptap/core';

import { allFormatToggles } from './definitions';
import Root from './Format.svelte';
import Group from './FormatGroup.svelte';
import Insert from './FormatInsert.svelte';
import HorizontalRule from './FormatInsertHorizontalRule.svelte';
import InsertImage from './FormatInsertImage.svelte';
import InsertTable from './FormatInsertTable.svelte';
import Redo from './FormatRedo.svelte';
import Toggle from './FormatToggle.svelte';
import Blockquote from './FormatToggleBlockquote.svelte';
import Bold from './FormatToggleBold.svelte';
import BulletList from './FormatToggleBulletList.svelte';
import Heading from './FormatToggleHeading.svelte';
import Italic from './FormatToggleItalic.svelte';
import OrderedList from './FormatToggleOrderedList.svelte';
import Undo from './FormatUndo.svelte';

// Which controls are currently on, as the group's pressed keys.
//
// Derived from the same table the buttons render from, so this can never ask
// about a name no button uses — which is exactly what it used to do, with its
// own hand-written list of five strings plus a heading-level lookup.
const getFormattingActive = (editor: Editor | undefined): string[] => {
    if (!editor) return [];

    return allFormatToggles()
        .filter((definition) => definition.isActive(editor))
        .map((definition) => definition.value);
};

const getWordBoundary = (
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

const toggleWithWordBoundary = (
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

export {
    Blockquote,
    Bold,
    BulletList,
    getFormattingActive,
    getWordBoundary,
    Group,
    Heading,
    HorizontalRule,
    Insert,
    InsertImage,
    InsertTable,
    Italic,
    OrderedList,
    Redo,
    Root,
    Toggle,
    toggleWithWordBoundary,
    Undo
};
