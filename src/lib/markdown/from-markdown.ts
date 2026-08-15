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

const EMPTY_DOC: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph' }]
};

export function fromMarkdown(md: string): JSONContent {
    if (md.trim().length === 0) return EMPTY_DOC;

    // `async: false` keeps parse() synchronous; marked's types still widen the
    // return to string | Promise<string>, hence the assertion.
    const html = marked.parse(md, { async: false }) as string;
    const doc = generateJSON(html, documentExtensions());

    // A document that parsed to nothing (e.g. a file of only whitespace or
    // comments) would be an invalid empty doc for ProseMirror.
    const content = doc.content as JSONContent[] | undefined;
    return content && content.length > 0 ? doc : EMPTY_DOC;
}
