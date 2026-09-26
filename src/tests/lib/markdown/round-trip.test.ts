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
        // The link dialog only makes http, https and mailto links, but that rule
        // lives in the dialog. Links already in a writer's files must keep
        // their mark, or the next autosave writes them back as plain text.
        ['relative link', 'See [my notes](notes.md) first.'],
        ['anchor link', 'Back to [the top](#title).'],
        ['email link', 'Write to [Ada](mailto:ada@example.com).'],
        ['bullet list', '-   One\n-   Two\n-   Three'],
        ['ordered list', '1.  One\n2.  Two\n3.  Three'],
        ['nested bullet list', '-   One\n    -   Nested'],
        ['unchecked task', '-   [ ] Buy milk'],
        ['checked task', '-   [x] Post the letter'],
        ['task list', '-   [ ] Draft it\n-   [x] Read it aloud'],
        ['task with inline marks', '-   [ ] Read the **opening** again'],
        ['nested task list', '-   [ ] Chapter one\n    -   [x] Scene one'],
        ['empty task', '-   [ ]'],
        ['empty task above a written one', '-   [ ]\n-   [x] Written'],
        ['empty task nested', '-   [ ] Chapter one\n    -   [ ]'],
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

    // The permissive parse above still has a floor. A script address in a file
    // must never become a clickable link in the editor — the text survives, the
    // link does not.
    it('never makes a link of a javascript: address', () => {
        const json = JSON.stringify(
            fromMarkdown('Do not [click](javascript:alert(1)) this.')
        );

        expect(json).toContain('click');
        expect(json).not.toContain('"type":"link"');
        expect(json).not.toContain('javascript:');
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
            '-   [ ] Still to do',
            '-   [x] Already done',
            '',
            '![Diagram](diagram.png)',
            '',
            '| Column | Value |',
            '| --- | --- |',
            '| One | 1 |'
        ].join('\n');

        expect(roundTrip(md)).toBe(md);
    });

    // Everything the toolbar's menus and the code toggle can make, together:
    // inline code, a fenced code block, each list, a quotation and a rule.
    it('preserves a document using every menu and code control', () => {
        const md = [
            '# Title',
            '',
            'Call `toMarkdown()` before the write.',
            '',
            '```',
            'const a = 1;',
            '```',
            '',
            '-   Bullet',
            '',
            '1.  Numbered',
            '',
            '-   [ ] Checklist',
            '',
            '> A quotation.',
            '',
            '* * *',
            '',
            'The end.'
        ].join('\n');

        expect(roundTrip(md)).toBe(md);
    });

    // The text-style menu's Text item, applied to every heading level: what
    // lands on disk is plain paragraphs, and they read back the same.
    it('preserves headings switched back to body text', () => {
        const levels = [1, 2, 3, 4];
        const headings = fromMarkdown(
            levels
                .map((level) => `${'#'.repeat(level)} Line ${level}`)
                .join('\n\n')
        );
        const asText = {
            ...headings,
            content: headings.content?.map((node) => ({
                ...node,
                type: 'paragraph',
                attrs: undefined
            }))
        };
        const md = levels.map((level) => `Line ${level}`).join('\n\n');

        expect(toMarkdown(asText)).toBe(md);
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

    // GFM lets a plain bullet sit among ticked ones; TipTap's taskList holds
    // taskItems and nothing else. The whole list becomes a task list, so the
    // plain item gains an empty box — one changed line, where splitting the list
    // in two would silently reflow it. The second pass is what has to be stable.
    it('turns a list mixing tasks and plain bullets into one task list', () => {
        const once = roundTrip('-   [x] Ticked\n-   Plain');

        expect(once).toBe('-   [x] Ticked\n-   [ ] Plain');
        expect(roundTrip(once)).toBe(once);
    });

    // A bullet list and a task list with only a blank line between them are one
    // loose list to any CommonMark parser — the blank line makes an item loose,
    // it does not start a second list. So they merge, and by the rule above the
    // merged list is a task list. Nothing in the converters can see two lists
    // where the markdown has one; the alternative would be writing `<!-- -->`
    // separators into a writer's prose. Recorded here so it is a known shape
    // rather than a surprise.
    it('merges a bullet list written directly above a task list', () => {
        expect(roundTrip('-   Plain\n\n-   [x] Ticked')).toBe(
            '-   [ ] Plain\n-   [x] Ticked'
        );
    });

    // GFM accepts `1. [ ] One`, but there is no ordered task list to parse it
    // into. Keeping the number would mean dropping the tick, and a lost number is
    // visible in a way a lost tick is not.
    it('keeps the ticks of an ordered task list, losing the numbering', () => {
        const once = roundTrip('1.  [ ] One\n2.  [x] Two');

        expect(once).toBe('-   [ ] One\n-   [x] Two');
        expect(roundTrip(once)).toBe(once);
    });

    // Pressing Enter on a checklist makes an item with no words in it, and GFM
    // has no way to write one: it requires content after `- [ ]`, so marked reads
    // the marker back as the literal characters. Left alone the writer's blank
    // line reopened as the text `[ ]`, and the item stopped being a checkbox.
    it('keeps an item that has a checkbox but no words yet', () => {
        const list = fromMarkdown('-   [ ]\n-   [x] Written').content?.[0];

        expect(list?.type).toBe('taskList');
        expect(list?.content?.map((item) => item.attrs?.checked)).toEqual([
            false,
            true
        ]);
    });

    // …and writes it as one clean line. turndown's marker rule emits `[ ] `
    // expecting words to follow, so an empty item used to carry a trailing space
    // into the file — and a blank paragraph beside it made the whole list loose.
    it('writes an empty item without trailing space or a loose list', () => {
        expect(toMarkdown(fromMarkdown('-   [ ]\n-   [x] Written'))).toBe(
            '-   [ ]\n-   [x] Written'
        );
    });

    // The pair of normalisers is the only thing standing between a ticked file
    // and a silently unticked one, so assert the state itself rather than only
    // the text around it.
    it('carries the checked state into the document model', () => {
        const list = fromMarkdown('-   [ ] Open\n-   [x] Done').content?.[0];

        expect(list?.type).toBe('taskList');
        expect(list?.content?.map((item) => item.attrs?.checked)).toEqual([
            false,
            true
        ]);
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
