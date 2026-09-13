import { Extension } from '@tiptap/core';

export interface LinkKeymapOptions {
    onOpen: () => void;
}

// ⌘K / Ctrl+K opens the link dialog — the keys a writer already reaches for in
// every other editor, and the ones the toolbar button's tooltip names.
//
// Editor-only: it adds a keymap and no content, so it sits in PageEditor's own
// extension list beside Placeholder, never in `documentExtensions()`, which is
// the node set the markdown converters share.
export const LinkKeymap = Extension.create<LinkKeymapOptions>({
    name: 'linkKeymap',

    addOptions() {
        return { onOpen: () => {} };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-k': () => {
                this.options.onOpen();
                // Claimed either way: left to the browser, Ctrl+K moves focus
                // to the address bar and out of the writing.
                return true;
            }
        };
    }
});
