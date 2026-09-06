import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import TurndownService from 'turndown';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- ships no types
// @ts-ignore -- turndown-plugin-gfm has no bundled type declarations
import { tables, taskListItems } from 'turndown-plugin-gfm';

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

// GFM task list markers — `[x] ` / `[ ] ` in front of an item's text. The rule
// only fires on a checkbox that is a direct child of its `<li>`, which is not the
// shape TipTap renders; `normaliseTaskLists` below is what puts it there.
turndown.use(taskListItems);

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
// wrapper when the item's own text is that one paragraph; cells and items that
// genuinely hold several paragraphs keep their breaks.
//
// "Its own text" rather than "its only child", because two things legitimately
// sit beside that paragraph without making the item loose: a nested list, and the
// checkbox `normaliseTaskLists` prepends to a task item. Requiring a sole child
// left both rendering loose — a nested bullet list round-tripped to
// `-   One\n    \n    -   Two`, gaining a blank line and trailing whitespace on
// every save.
const PARAGRAPH_WRAPPERS = new Set(['LI', 'TD', 'TH']);
const NESTED_LISTS = new Set(['UL', 'OL']);

function isCheckbox(node: ChildNode): boolean {
    return (
        node.nodeName === 'INPUT' &&
        (node as Element).getAttribute('type') === 'checkbox'
    );
}

function isIgnorableBeside(node: ChildNode, paragraph: Node): boolean {
    if (node === paragraph) return true;
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? '').trim() === '';
    }
    return isCheckbox(node) || NESTED_LISTS.has(node.nodeName);
}

turndown.addRule('unwrapSoleParagraph', {
    filter: (node) => {
        if (node.nodeName !== 'P') return false;
        const parent = node.parentNode;
        if (parent === null || !PARAGRAPH_WRAPPERS.has(parent.nodeName)) {
            return false;
        }

        // Only the first paragraph is the item's own text. A second one is a
        // genuine extra block and has to keep its break.
        const paragraphs = Array.from(parent.childNodes).filter(
            (child) => child.nodeName === 'P'
        );
        if (paragraphs[0] !== node) return false;

        return Array.from(parent.childNodes).every((child) =>
            isIgnorableBeside(child, node)
        );
    },
    replacement: (content) => content
});

// TipTap emits header cells as `<th>` inside `<tbody>` with no `<thead>`, and adds
// a `<colgroup>` for column sizing. turndown-plugin-gfm's table rule detects the
// header row via `<thead>`, so without this it bails and emits raw HTML.
function normaliseTables(doc: Document): void {
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
}

// TipTap renders a task item as
// `<li data-type="taskItem" data-checked="true"><label><input …><span></span>
// </label><div><p>Text</p></div></li>` — the checkbox buried in a label, the
// content in a div. turndown-plugin-gfm's `taskListItems` rule only fires on a
// checkbox whose direct parent is the `<li>`, so left alone it never matches and
// the item's checked state is dropped silently: `- [x] Done` comes back as
// `- Done`, losing the user's ticks on the next save.
//
// Rewrite each item into the plain shape that rule does recognise — the same
// shape marked produces when parsing GFM, which keeps both directions agreeing on
// one intermediate form.
function normaliseTaskLists(doc: Document): void {
    for (const item of doc.querySelectorAll('li[data-type="taskItem"]')) {
        const checked = item.getAttribute('data-checked') === 'true';

        // The label holds the checkbox and its styling span, neither of which
        // means anything in markdown.
        item.querySelector(':scope > label')?.remove();

        // The div is a rendering wrapper; its children are the item's real
        // content, and the tight-item rule above needs to see them directly.
        const wrapper = item.querySelector(':scope > div');
        if (wrapper) {
            while (wrapper.firstChild) {
                item.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        }

        // An item the writer has only just made — Enter on a checklist, or the
        // toolbar on a blank line — holds one empty paragraph. turndown treats a
        // blank block as its own thing and emits a paragraph break for it, which
        // makes the whole list loose and leaves a line of trailing spaces in the
        // file. The marker alone is the item.
        const sole = item.children.length === 1 ? item.firstElementChild : null;
        if (sole?.tagName === 'P' && sole.textContent?.trim() === '') {
            sole.remove();
        }

        const checkbox = doc.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        if (checked) checkbox.setAttribute('checked', 'checked');
        item.insertBefore(checkbox, item.firstChild);
    }
}

// An item holding only its marker: the checkbox rule writes `[ ] ` expecting text
// to follow, and for an empty item nothing does. The stray space is invisible but
// it lands in the writer's file, and `trim()` only reaches one at the very end —
// so the same empty item is written two different ways depending on where it sits.
// Matched tightly enough that a line ending in real writing is never touched, and
// a hard break's two trailing spaces are not a task marker.
const TRAILING_MARKER_SPACE = /^([ \t]*[-*+] +\[[ xX]\]) +$/gm;

export function toMarkdown(doc: JSONContent): string {
    const html = generateHTML(doc, documentExtensions());
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    normaliseTables(parsed);
    normaliseTaskLists(parsed);

    return turndown
        .turndown(parsed.body.innerHTML)
        .replace(TRAILING_MARKER_SPACE, '$1')
        .trim();
}
