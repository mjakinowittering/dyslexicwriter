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

// The mirror of `normaliseTaskLists` in to-markdown.ts, and the two only work as
// a pair. marked renders a GFM task item as a plain
// `<li><input disabled type="checkbox"> Text</li>` — no attributes on the list.
// TipTap matches TaskList and TaskItem on `data-type`, so without this the list
// parses as an ordinary bullet list and the checkbox is discarded: every tick in
// the file is lost the moment it is opened.
//
// A list counts as a task list when *any* item carries a checkbox. GFM allows a
// plain bullet among ticked ones, but TipTap's taskList holds taskItems and
// nothing else, so the plain item becomes an unchecked task rather than the list
// being split in two. That rewrites `- Plain` as `- [ ] Plain` on the next save —
// a visible change to one line, where splitting would silently reflow the list.
const CHECKED = new Set(['', 'checked', 'true']);

function checkboxOf(item: Element): HTMLInputElement | null {
    // Tight items hold the checkbox directly; a loose list wraps each item's
    // content in a paragraph and the checkbox goes inside it.
    return item.querySelector(
        ':scope > input[type="checkbox"], :scope > p:first-child > input[type="checkbox"]'
    );
}

// An item with a marker but no words after it. GFM requires content following
// `- [ ]`, so marked hands back the literal characters rather than a checkbox —
// and an item with no words is exactly what pressing Enter on a checklist makes.
// We wrote it, so we have to be able to read it: without this, a writer's blank
// checklist line comes back as the text `[ ]` the next time they open the file.
const EMPTY_MARKER = /^\[[ xX]\]$/;

function literalMarkerOf(item: Element): ChildNode | null {
    const host = item.querySelector(':scope > p:first-child') ?? item;
    const first = host.firstChild;

    if (first === null || first.nodeType !== Node.TEXT_NODE) return null;

    // The whole of the item's first text run, so an item that merely opens with
    // a bracket is left alone — anything with words after the marker was a real
    // checkbox to marked and never reaches here.
    return EMPTY_MARKER.test((first.textContent ?? '').trim()) ? first : null;
}

function normaliseTaskLists(doc: Document): void {
    // Ordered lists included: GFM accepts `1. [ ] One`, and marked emits the same
    // checkbox inside an `<ol>`. TipTap has no ordered task list, so such a list
    // becomes an unordered one — the numbering is lost where the ticks would
    // otherwise be, and a lost number is visible in a way a lost tick is not.
    for (const list of doc.querySelectorAll('ul, ol')) {
        const items = Array.from(list.querySelectorAll(':scope > li'));
        const isTask = (item: Element) =>
            checkboxOf(item) !== null || literalMarkerOf(item) !== null;
        if (!items.some(isTask)) continue;

        for (const item of items) {
            const checkbox = checkboxOf(item);
            const literal = checkbox === null ? literalMarkerOf(item) : null;
            const checked =
                checkbox !== null
                    ? CHECKED.has(checkbox.getAttribute('checked') ?? 'false')
                    : (literal?.textContent ?? '').trim().toLowerCase() ===
                      '[x]';

            checkbox?.remove();
            literal?.remove();
            item.setAttribute('data-type', 'taskItem');
            item.setAttribute('data-checked', String(checked));
        }

        if (list.tagName === 'OL') {
            const replacement = doc.createElement('ul');
            while (list.firstChild) replacement.appendChild(list.firstChild);
            list.replaceWith(replacement);
            replacement.setAttribute('data-type', 'taskList');
        } else {
            list.setAttribute('data-type', 'taskList');
        }
    }
}

export function fromMarkdown(md: string): JSONContent {
    if (md.trim().length === 0) return emptyDocument();

    // `async: false` keeps parse() synchronous; marked's types still widen the
    // return to string | Promise<string>, hence the assertion.
    const html = marked.parse(md, { async: false }) as string;
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    normaliseTaskLists(parsed);

    const doc = generateJSON(parsed.body.innerHTML, documentExtensions());

    // A document that parsed to nothing (e.g. a file of only whitespace or
    // comments) would be an invalid empty doc for ProseMirror.
    const content = doc.content as JSONContent[] | undefined;
    return content && content.length > 0 ? doc : emptyDocument();
}
