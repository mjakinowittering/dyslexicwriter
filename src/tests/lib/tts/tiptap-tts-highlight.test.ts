import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';

import { documentExtensions } from '$lib/markdown';
import { listItemsInRange } from '$lib/tts/tiptap-tts-highlight';

// The editor's own node set, so `taskItem` is in the schema alongside `listItem`
// — the two types a marker hangs off.
const schema = getSchema(documentExtensions());

function doc(json: JSONContent): Node {
    return Node.fromJSON(schema, json);
}

function paragraph(text: string): JSONContent {
    return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function bulletList(...items: JSONContent[][]): JSONContent {
    return {
        type: 'bulletList',
        content: items.map((content) => ({ type: 'listItem', content }))
    };
}

// The range covering `text` wherever it appears in the document, found by walking
// the doc rather than counting positions by hand — a hand-counted position is a
// second thing to get wrong, and it is the item the range lands in that these
// tests are about.
function rangeOf(node: Node, text: string): { from: number; to: number } {
    let found: { from: number; to: number } | null = null;
    node.descendants((child, pos) => {
        if (found || !child.isText || !child.text) return true;
        const at = child.text.indexOf(text);
        if (at < 0) return true;
        found = { from: pos + at, to: pos + at + text.length };
        return false;
    });
    if (!found) throw new Error(`no text "${text}" in the document`);
    return found;
}

// The text each returned range encloses, which is what says the right item was
// picked — reading positions back would just restate the implementation.
function textOf(node: Node, ranges: { from: number; to: number }[]): string[] {
    return ranges.map((range) =>
        node.textBetween(range.from, range.to, ' ').trim()
    );
}

describe('listItemsInRange', () => {
    it('returns the item holding the range', () => {
        const node = doc({
            type: 'doc',
            content: [
                bulletList(
                    [paragraph('First point.')],
                    [paragraph('Second point.')]
                )
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'First point.'));

        expect(textOf(node, items)).toEqual(['First point.']);
    });

    it('returns every item a range spans', () => {
        const node = doc({
            type: 'doc',
            content: [
                bulletList([paragraph('One and')], [paragraph('two together.')])
            ]
        });

        const first = rangeOf(node, 'One and');
        const second = rangeOf(node, 'two together.');
        const items = listItemsInRange(node, {
            from: first.from,
            to: second.to
        });

        expect(textOf(node, items)).toEqual(['One and', 'two together.']);
    });

    it('returns the innermost item for text in a nested list', () => {
        const node = doc({
            type: 'doc',
            content: [
                bulletList([
                    paragraph('Outer point.'),
                    bulletList([paragraph('Inner point.')])
                ])
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'Inner point.'));

        expect(textOf(node, items)).toEqual(['Inner point.']);
    });

    it("returns only the outer item for text in the outer item's own block", () => {
        const node = doc({
            type: 'doc',
            content: [
                bulletList([
                    paragraph('Outer point.'),
                    bulletList([paragraph('Inner point.')])
                ])
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'Outer point.'));

        // The outer item's range encloses the nested list, so its text carries
        // the inner point with it — one item, not two.
        expect(items).toHaveLength(1);
        expect(textOf(node, items)[0]).toContain('Outer point.');
    });

    it("lands on the item, not inside it, for an item's second block", () => {
        const node = doc({
            type: 'doc',
            content: [
                bulletList([
                    paragraph('First block.'),
                    paragraph('Second block.')
                ])
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'Second block.'));

        expect(items).toHaveLength(1);
        expect(textOf(node, items)[0]).toContain('First block.');
    });

    it('returns the task item holding the range', () => {
        const node = doc({
            type: 'doc',
            content: [
                {
                    type: 'taskList',
                    content: [
                        {
                            type: 'taskItem',
                            attrs: { checked: false },
                            content: [paragraph('Buy milk.')]
                        }
                    ]
                }
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'Buy milk.'));

        expect(textOf(node, items)).toEqual(['Buy milk.']);
    });

    it('returns nothing for a range outside any list', () => {
        const node = doc({
            type: 'doc',
            content: [
                paragraph('Just prose.'),
                bulletList([paragraph('A point.')])
            ]
        });

        const items = listItemsInRange(node, rangeOf(node, 'Just prose.'));

        expect(items).toEqual([]);
    });

    it('ignores an item the range only touches the edge of', () => {
        const node = doc({
            type: 'doc',
            content: [
                paragraph('Prose above.'),
                bulletList([paragraph('A point.')])
            ]
        });

        const prose = rangeOf(node, 'Prose above.');
        const point = rangeOf(node, 'A point.');
        // Ends exactly where the item's own text begins: no overlap, so the
        // marker beside it must stay dark.
        const items = listItemsInRange(node, {
            from: prose.from,
            to: point.from
        });

        expect(items).toEqual([]);
    });
});
