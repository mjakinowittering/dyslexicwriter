import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import TurndownService from 'turndown';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- ships no types
// @ts-ignore -- turndown-plugin-gfm has no bundled type declarations
import { tables } from 'turndown-plugin-gfm';

import { documentExtensions } from './extensions';

// TipTap JSON → Markdown. This is what actually lands on the user's disk, so it is
// the format of record: the .md file is the document, not a cache of one.
//
// The route is JSON → HTML (via the shared extension set) → normalise → Markdown.
// Going through HTML means we inherit TipTap's own serialization for every node
// rather than hand-writing a second serializer that could disagree with it.
const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**'
});

// GFM tables. Core turndown cannot represent them at all and falls back to raw
// HTML, which would put literal <table> markup in the user's markdown file.
turndown.use(tables);

// turndown-plugin-gfm emits single-tilde `~struck~`, which GFM (and therefore
// marked, on the way back in) does not recognise as strikethrough — the round-trip
// would degrade it to literal tildes. Emit the two-tilde form instead.
turndown.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`
});

// TipTap models list-item and table-cell content as a paragraph
// (`<li><p>text</p></li>`, `<td><p>text</p></td>`). turndown renders that as a
// loose list (a blank line between every bullet) and as newlines inside table
// cells, which breaks the single-line-per-row table syntax entirely. Collapse the
// wrapper when it is the only child; cells and items that genuinely hold several
// blocks keep their paragraph breaks.
const PARAGRAPH_WRAPPERS = new Set(['LI', 'TD', 'TH']);

turndown.addRule('unwrapSoleParagraph', {
    filter: (node) =>
        node.nodeName === 'P' &&
        node.parentNode !== null &&
        PARAGRAPH_WRAPPERS.has(node.parentNode.nodeName) &&
        node.parentNode.childNodes.length === 1,
    replacement: (content) => content
});

// TipTap emits header cells as `<th>` inside `<tbody>` with no `<thead>`, and adds
// a `<colgroup>` for column sizing. turndown-plugin-gfm's table rule detects the
// header row via `<thead>`, so without this it bails and emits raw HTML.
function normaliseTables(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const table of doc.querySelectorAll('table')) {
        // Column widths are a screen affordance with no markdown equivalent.
        table.querySelector('colgroup')?.remove();
        table.removeAttribute('style');

        if (table.querySelector('thead')) continue;

        const firstRow = table.querySelector('tr');
        if (!firstRow || firstRow.querySelector('th') === null) continue;

        const thead = doc.createElement('thead');
        thead.appendChild(firstRow);
        table.insertBefore(thead, table.firstChild);
    }

    return doc.body.innerHTML;
}

export function toMarkdown(doc: JSONContent): string {
    const html = generateHTML(doc, documentExtensions());
    return turndown.turndown(normaliseTables(html)).trim();
}
