import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';

import {
    findInvisibles,
    type Invisible
} from '$lib/components/Editor/Page/invisible-characters';

import { documentExtensions } from '$lib/markdown';

// The editor's own node set, so hard breaks, lists and tables are all real.
const schema = getSchema(documentExtensions());

function doc(...content: JSONContent[]): Node {
    return Node.fromJSON(schema, { type: 'doc', content });
}

function text(value: string): JSONContent {
    return { type: 'text', text: value };
}

function paragraph(...content: JSONContent[]): JSONContent {
    return { type: 'paragraph', content };
}

function ofKind(found: Invisible[], kind: Invisible['kind']): number[] {
    return found.filter((item) => item.kind === kind).map((item) => item.pos);
}

// What each position actually is in the document, read back off the node —
// a hand-counted position would just be a second thing to get wrong.
function isSpace(node: Node, pos: number): boolean {
    return node.textBetween(pos, pos + 1) === ' ';
}

function isTextblockEnd(node: Node, pos: number): boolean {
    const $pos = node.resolve(pos);
    return (
        $pos.parent.isTextblock &&
        $pos.parentOffset === $pos.parent.content.size
    );
}

describe('findInvisibles', () => {
    it('marks every space and the end of the paragraph', () => {
        const node = doc(paragraph(text('The lantern room')));
        const found = findInvisibles(node);

        const spaces = ofKind(found, 'space');
        expect(spaces).toHaveLength(2);
        expect(spaces.every((pos) => isSpace(node, pos))).toBe(true);

        const ends = ofKind(found, 'paragraph');
        expect(ends).toHaveLength(1);
        expect(isTextblockEnd(node, ends[0] as number)).toBe(true);
    });

    it('marks a hard break at the break itself', () => {
        const node = doc(
            paragraph(text('One'), { type: 'hardBreak' }, text('Two'))
        );
        const breaks = ofKind(findInvisibles(node), 'break');

        expect(breaks).toHaveLength(1);
        expect(node.nodeAt(breaks[0] as number)?.type.name).toBe('hardBreak');
    });

    // The one a writer most needs to see: nothing else on the line says it is
    // there.
    it('gives an empty paragraph its pilcrow', () => {
        const node = doc(
            paragraph(text('Before')),
            { type: 'paragraph' },
            paragraph(text('After'))
        );
        const ends = ofKind(findInvisibles(node), 'paragraph');

        expect(ends).toHaveLength(3);
        expect(ends.every((pos) => isTextblockEnd(node, pos))).toBe(true);
    });

    it('marks headings, list items and table cells alike', () => {
        const node = doc(
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [text('Title')]
            },
            {
                type: 'bulletList',
                content: [
                    {
                        type: 'listItem',
                        content: [paragraph(text('A point'))]
                    }
                ]
            },
            {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableHeader',
                                content: [paragraph(text('Head'))]
                            },
                            {
                                type: 'tableCell',
                                content: [paragraph(text('Cell'))]
                            }
                        ]
                    }
                ]
            }
        );
        const found = findInvisibles(node);

        // Heading, the list item's paragraph, and one per cell.
        expect(ofKind(found, 'paragraph')).toHaveLength(4);
        expect(ofKind(found, 'space')).toHaveLength(1);
    });

    it('leaves tabs and non-breaking spaces unmarked', () => {
        const node = doc(paragraph(text('one\ttwo three')));

        expect(ofKind(findInvisibles(node), 'space')).toHaveLength(0);
    });

    it('returns markers in document order', () => {
        const node = doc(paragraph(text('a b')), paragraph(text('c d')));
        const positions = findInvisibles(node).map((item) => item.pos);

        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(findInvisibles(node).map((item) => item.kind)).toEqual([
            'space',
            'paragraph',
            'space',
            'paragraph'
        ]);
    });
});
