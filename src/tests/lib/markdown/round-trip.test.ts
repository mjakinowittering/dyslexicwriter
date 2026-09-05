import { describe, expect, it } from 'vitest';

import { formatMarkdown } from '$lib/markdown/format';
import { fromMarkdown } from '$lib/markdown/from-markdown';
import { joinFrontmatter, splitFrontmatter } from '$lib/markdown/frontmatter';
import { toMarkdown } from '$lib/markdown/to-markdown';
import type { PrettierPreferences } from '$lib/models/prettier.model';

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

// Formatting sits between `toMarkdown` and the disk, so it is on the path every
// save takes. It changes the bytes deliberately — that is the point — so what has
// to hold is that it never changes the DOCUMENT: reading a formatted file back must
// give the editor exactly what it had before.
describe('formatting preserves the document', () => {
    const WRAP: PrettierPreferences = { printWidth: 80, proseWrap: 'always' };

    async function formatted(md: string) {
        return fromMarkdown(
            await formatMarkdown(toMarkdown(fromMarkdown(md)), WRAP)
        );
    }

    it('leaves every supported node identical after a formatted save', async () => {
        const md = [
            '# Title',
            '',
            'An **opening** paragraph with a [link](https://example.com), long enough that wrapping it at eighty columns takes more than one line.',
            '',
            '## Section',
            '',
            '-   First',
            '-   Second',
            '',
            '> A quotation that also runs past the eighty column limit and therefore has to be wrapped across lines.',
            '',
            '![Diagram](diagram.png)',
            '',
            '| Column | Value |',
            '| --- | --- |',
            '| One | 1 |'
        ].join('\n');

        expect(await formatted(md)).toEqual(fromMarkdown(md));
    });

    // The one way hard wrapping could corrupt writing: a break that pushes a `1.`,
    // `-`, `#`, `>` or `+` to column 0, where it re-parses as markup and the
    // paragraph becomes a list. Prettier guards it by moving the break earlier —
    // these sentences are positioned so a naive wrap at eighty would not.
    it.each([
        [
            'a number that would land at a line start',
            'He counted them all up and the final total came to exactly one thousand and 1. Then he went home.'
        ],
        [
            'a hyphen that would land at a line start',
            'She looked at the sky for a long while and thought about the weather today - it was grey and cold.'
        ],
        [
            'a hash that would land at a line start',
            'The tag he had chosen for the whole project was going to be called simply # after all was said.'
        ],
        [
            'a greater-than that would land at a line start',
            'The comparison he wrote in his notes was straightforward enough, just a plain a > b and nothing more.'
        ],
        [
            'a plus that would land at a line start',
            'The maths in the margin was scrawled quickly and read three plus four plus five + six equals eighteen.'
        ]
    ])('does not turn %s into markup', async (_label, md) => {
        expect(await formatted(md)).toEqual(fromMarkdown(md));
    });

    // Autosave formats an already-formatted file on every save, forever, so a
    // second pass must not drift the document either.
    it('is stable across repeated formatted saves', async () => {
        const md =
            'A paragraph long enough to wrap at eighty columns when it is formatted for disk.\n\n-   Item';
        const once = await formatMarkdown(toMarkdown(fromMarkdown(md)), WRAP);
        const twice = await formatMarkdown(
            toMarkdown(fromMarkdown(once)),
            WRAP
        );

        expect(twice).toBe(once);
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
