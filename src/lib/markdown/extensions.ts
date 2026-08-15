import { Image } from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';

// THE single definition of which nodes and marks a document may contain.
//
// Three places must agree on this set or documents silently lose content:
//   1. the editor          (what the writer can create)
//   2. toMarkdown          (what can be written to disk)
//   3. fromMarkdown        (what can be read back)
//
// They all call this factory, so they cannot drift. Adding a node here without
// also teaching turndown (toMarkdown) and marked (fromMarkdown) to handle it will
// fail the round-trip tests — which is the point.
export interface DocumentExtensionOptions {
    // TrailingNode auto-appends an empty paragraph after a terminal block (e.g. a
    // table or blockquote) so the writer can type past it. Wanted while editing,
    // unwanted when converting, where it just produces dangling whitespace.
    trailingNode?: boolean;
}

export function documentExtensions({
    trailingNode = false
}: DocumentExtensionOptions = {}) {
    return [
        StarterKit.configure({
            link: {
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-4 hover:text-primary/80'
                }
            },
            trailingNode: trailingNode ? undefined : false
        }),
        // Images are real files beside the document; `src` is always a relative
        // path within the document's own folder, never a data: URI.
        Image.configure({
            inline: false,
            allowBase64: false
        }),
        // Column resizing is a mouse-driven affordance that markdown cannot
        // represent, so it is off — the round-trip would discard it anyway.
        TableKit.configure({
            table: { resizable: false }
        })
    ];
}
