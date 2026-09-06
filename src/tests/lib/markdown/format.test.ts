import { describe, expect, it } from 'vitest';

import { formatMarkdown } from '$lib/markdown';
import type { PrettierPreferences } from '$lib/models/prettier.model';

const WRAP: PrettierPreferences = { printWidth: 80, proseWrap: 'always' };
const PRESERVE: PrettierPreferences = { printWidth: 80, proseWrap: 'preserve' };

// One long sentence, comfortably past eighty columns on one line.
const LONG =
    'The quick brown fox jumps over the lazy dog and then keeps running for quite some distance before it stops.';

describe('formatMarkdown — wrapping', () => {
    it('wraps prose at the print width', async () => {
        const formatted = await formatMarkdown(LONG, WRAP);

        expect(formatted).toContain('\n');
        for (const line of formatted.split('\n')) {
            expect(line.length).toBeLessThanOrEqual(WRAP.printWidth);
        }
    });

    it('wraps at whatever width it is given', async () => {
        const formatted = await formatMarkdown(LONG, {
            printWidth: 40,
            proseWrap: 'always'
        });

        for (const line of formatted.split('\n')) {
            expect(line.length).toBeLessThanOrEqual(40);
        }
    });

    // printWidth alone does nothing to prose — proseWrap is the key that turns
    // wrapping on, which is why both are stored rather than just the width.
    it('leaves prose alone under the preserve wrap mode', async () => {
        expect(await formatMarkdown(LONG, PRESERVE)).toBe(LONG);
    });

    it('keeps the wrapped prose inside its blockquote', async () => {
        const formatted = await formatMarkdown(`> ${LONG}`, WRAP);

        expect(formatted.split('\n').length).toBeGreaterThan(1);
        for (const line of formatted.split('\n')) {
            expect(line.startsWith('> ')).toBe(true);
        }
    });
});

describe('formatMarkdown — tidying', () => {
    it.each([
        // turndown pads its bullets to three spaces
        ['-   One\n-   Two', '- One\n- Two'],
        ['*   One\n*   Two', '- One\n- Two'],
        // and writes a spaced thematic break
        ['Above\n\n* * *\n\nBelow', 'Above\n\n---\n\nBelow'],
        // unpadded table pipes
        [
            '| A | B |\n| --- | --- |\n| 1 | 2 |',
            '| A   | B   |\n| --- | --- |\n| 1   | 2   |'
        ]
    ])('normalises %j', async (input, expected) => {
        expect(await formatMarkdown(input, WRAP)).toBe(expected);
    });

    // Bullets are normalised to `- `, but an ordered marker's alignment is left as
    // it was found (capped at two spaces). turndown already emits `1.  `, so the
    // ordered lists this app writes come through unchanged — which is what the
    // round-trip fixtures encode.
    it('leaves an ordered list marker aligned as it found it', async () => {
        expect(await formatMarkdown('1.  One\n2.  Two', WRAP)).toBe(
            '1.  One\n2.  Two'
        );
        expect(await formatMarkdown('1. One\n2. Two', WRAP)).toBe(
            '1. One\n2. Two'
        );
    });

    it('leaves a fenced code block untouched', async () => {
        const code = '```js\nconst x = 1;\n```';

        expect(await formatMarkdown(code, WRAP)).toBe(code);
    });
});

describe('formatMarkdown — the edges that reach disk', () => {
    // `createDocument` writes an empty document, and an empty file is what it has
    // always produced. Prettier answers a blank input with a lone newline.
    it.each(['', '   ', '\n\n'])(
        'returns a blank document (%j) unchanged',
        async (blank) => {
            expect(await formatMarkdown(blank, WRAP)).toBe(blank);
        }
    );

    // `toMarkdown` trims and `joinFrontmatter` owns the trailing newline, so the
    // formatter has to be a drop-in for the string it replaces.
    it('emits no trailing newline of its own', async () => {
        expect(await formatMarkdown('# Hello', WRAP)).toBe('# Hello');
    });

    // Autosave reformats a file that is already formatted, on every save, forever.
    it('is idempotent on its own output', async () => {
        const once = await formatMarkdown(
            `# Title\n\n${LONG}\n\n-   a\n-   b`,
            WRAP
        );

        expect(await formatMarkdown(once, WRAP)).toBe(once);
    });
});
