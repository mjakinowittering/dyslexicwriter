import { Editor } from '@tiptap/core';

import { documentExtensions } from '$lib/markdown/extensions';

// A real TipTap editor for stories whose component only needs one to exist — the
// read-aloud transport disables itself without a live editor, so `editor: undefined`
// can only ever show the disabled state.
//
// Real rather than a stand-in because `Editor` is a class with private state: a
// hand-made object would have to be cast past the compiler, and this codebase does
// not cast. Destroy it on unmount, as the editor page does.
export function makeEditor(
    content = '<p>The quick brown fox jumps over the lazy dog.</p>'
): Editor {
    return new Editor({ extensions: documentExtensions(), content });
}
