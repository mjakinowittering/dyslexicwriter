import type { JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/html';
import { Marked } from 'marked';

import { documentExtensions } from './extensions';

// Markdown → TipTap JSON. The inverse of toMarkdown, and the reason a document can
// be closed and reopened: the .md file on disk is the only stored representation,
// so opening a document means parsing it back into the editor's model.
//
// Anything markdown cannot express is not in the editor's node set — see
// extensions.ts. The round-trip tests are what hold that line.
const marked = new Marked({
    gfm: true,
    // A single newline is a line break in the source, not a <br>. Writers use soft
    // wrapping in other editors; honouring it would litter documents with breaks.
    breaks: false
});

// A document with nothing in it: one empty paragraph, because ProseMirror will
// not accept a doc with no content at all.
//
// The one definition of this shape. A new document in the editor, one created
// from the Files screen, and a file that parsed to nothing all start here — three
// places that were each writing the literal out and could each drift.
//
// A factory rather than a shared constant. One of those callers assigns it
// straight into the document store's `$state`, where Svelte would deep-proxy it
// — and a single object handed to every new document is one in-place write away
// from two documents sharing content. Cheap to build, and nobody has to remember.
export function emptyDocument(): JSONContent {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function fromMarkdown(md: string): JSONContent {
    if (md.trim().length === 0) return emptyDocument();

    // `async: false` keeps parse() synchronous; marked's types still widen the
    // return to string | Promise<string>, hence the assertion.
    const html = marked.parse(md, { async: false }) as string;
    const doc = generateJSON(html, documentExtensions());

    // A document that parsed to nothing (e.g. a file of only whitespace or
    // comments) would be an invalid empty doc for ProseMirror.
    const content = doc.content as JSONContent[] | undefined;
    return content && content.length > 0 ? doc : emptyDocument();
}
