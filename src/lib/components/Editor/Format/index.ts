import type { Editor } from '@tiptap/core';

import { allFormatToggles } from './definitions';
import Root from './Format.svelte';
import Blocks from './FormatBlocks.svelte';
import Group from './FormatGroup.svelte';
import Insert from './FormatInsert.svelte';
import InsertMenu from './FormatInsertMenu.svelte';
import Invisibles from './FormatInvisibles.svelte';
import Lists from './FormatLists.svelte';
import Menu from './FormatMenu.svelte';
import MenuItem from './FormatMenuItem.svelte';
import Redo from './FormatRedo.svelte';
import TextStyle from './FormatTextStyle.svelte';
import Toggle from './FormatToggle.svelte';
import Bold from './FormatToggleBold.svelte';
import Code from './FormatToggleCode.svelte';
import Italic from './FormatToggleItalic.svelte';
import Undo from './FormatUndo.svelte';

// Which controls are currently on, as the group's pressed keys — and the list
// the menus read their state from.
//
// Derived from the same table the controls render from, so this can never ask
// about a name no control uses — which is exactly what it used to do, with its
// own hand-written list of five strings plus a heading-level lookup.
const getFormattingActive = (editor: Editor | undefined): string[] => {
    if (!editor) return [];

    return allFormatToggles()
        .filter((definition) => definition.isActive(editor))
        .map((definition) => definition.value);
};

export {
    Blocks,
    Bold,
    Code,
    getFormattingActive,
    Group,
    Insert,
    InsertMenu,
    Invisibles,
    Italic,
    Lists,
    Menu,
    MenuItem,
    Redo,
    Root,
    TextStyle,
    Toggle,
    Undo
};
