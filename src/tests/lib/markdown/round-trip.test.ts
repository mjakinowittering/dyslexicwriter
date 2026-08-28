import { describe, expect, it } from 'vitest';

import { fromMarkdown } from '$lib/markdown/from-markdown';
import { joinFrontmatter, splitFrontmatter } from '$lib/markdown/frontmatter';
import { toMarkdown } from '$lib/markdown/to-markdown';

// The document's only stored form is markdown, so every node the editor can
// produce must survive markdown -> JSON -> markdown unchanged. A node that fails
// these tests must not be added to the editor: it would silently lose the user's
// content the next time they opened the file.
function roundTrip(md: string): string {
    return toMarkdown(fromMarkdown(md));
}

describe('markdown round-trip', () => {
    it.each([
        ['paragraph', 'Just a plain sentence.'],
        ['two paragraphs', 'First paragraph.\n\nSecond paragraph.'],
        ['heading 1', '# Heading one'],
        ['heading 2', '## Heading two'],
        ['heading 3', '### Heading three'],
        ['heading 4', '#### Heading four'],
        ['bold', 'Some **bold** text.'],
        ['italic', 'Some *italic* text.'],
        ['bold and italic', 'Some ***bold italic*** text.'],
        ['strikethrough', 'Some ~~struck~~ text.'],
        ['inline code', 'Call `toMarkdown()` here.'],
        ['link', 'See [the docs](https://example.com) for more.'],
        ['bullet list', '-   One\n-   Two\n-   Three'],
        ['ordered list', '1.  One\n2.  Two\n3.  Three'],
        ['blockquote', '> Quoted wisdom.'],
        ['horizontal rule', 'Above\n\n* * *\n\nBelow'],
        ['image', '![A diagram](diagram.png)'],
        ['image without alt', '![](photo.jpg)'],
        ['fenced code block', '```\nconst a = 1;\n```'],
        [
            'table',
            '| Name | Role |\n| --- | --- |\n| Ada | Engineer |\n| Grace | Admiral |'
        ]
    ])('preserves %s', (_label, md) => {
        expect(roundTrip(md)).toBe(md);
    });

    it('preserves a document combining every supported node', () => {
        const md = [
            '# Title',
            '',
            'An **opening** paragraph with a [link](https://example.com).',
            '',
            '## Section',
            '',
            '-   First',
            '-   Second',
            '',
            '> A quotation.',
            '',
            '![Diagram](diagram.png)',
            '',
            '| Column | Value |',
            '| --- | --- |',
            '| One | 1 |'
        ].join('\n');

        expect(roundTrip(md)).toBe(md);
    });

    it('keeps image paths relative so they resolve inside the document folder', () => {
        const json = fromMarkdown('![Chart](sub-image.png)');
        expect(toMarkdown(json)).toContain('(sub-image.png)');
    });

    it('preserves a file that opens with YAML frontmatter', () => {
        // The whole file, as it sits on disk: fence, then document. The editor
        // never sees the fence, so it has to be split off and put back around the
        // markdown the editor did produce.
        const file = [
            '---',
            'title: My Chapter',
            'date: 2026-08-14',
            '---',
            '',
            '# Heading',
            '',
            'Some **bold** prose.'
        ].join('\n');

        const { frontmatter, body } = splitFrontmatter(file);
        const rewritten = joinFrontmatter(
            frontmatter,
            toMarkdown(fromMarkdown(body))
        );

        expect(rewritten).toBe(`${file}\n`);
    });

    it('is stable across repeated round-trips', () => {
        const md = '## Heading\n\nText with **bold** and a list:\n\n-   Item';
        const once = roundTrip(md);
        expect(roundTrip(once)).toBe(once);
    });
});

describe('fromMarkdown', () => {
    it('returns a valid empty document for empty input', () => {
        expect(fromMarkdown('')).toEqual({
            type: 'doc',
            content: [{ type: 'paragraph' }]
        });
    });

    it('returns a valid empty document for whitespace-only input', () => {
        expect(fromMarkdown('   \n\n  ')).toEqual({
            type: 'doc',
            content: [{ type: 'paragraph' }]
        });
    });

    it('produces a doc node', () => {
        expect(fromMarkdown('Hello').type).toBe('doc');
    });
});

describe('toMarkdown', () => {
    it('returns an empty string for an empty document', () => {
        expect(
            toMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })
        ).toBe('');
    });

    it('does not emit base64 for an image node', () => {
        const md = toMarkdown({
            type: 'doc',
            content: [
                {
                    type: 'image',
                    attrs: { src: 'photo.png', alt: 'Photo' }
                }
            ]
        });
        expect(md).toBe('![Photo](photo.png)');
    });
});
