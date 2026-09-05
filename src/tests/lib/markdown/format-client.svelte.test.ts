import { describe, expect, it } from 'vitest';

import { markdownFormatter } from '$lib/markdown';
import type { PrettierPreferences } from '$lib/models/prettier.model';

// The main-thread client, against the real worker in a real browser.
//
// One property matters more than everything else here: this never rejects. The
// document store's retry has no give-up ceiling, so a formatter that can fail a
// save would put a document into a loop that never reaches disk.

const WRAP: PrettierPreferences = { printWidth: 80, proseWrap: 'always' };

const LONG =
    'The quick brown fox jumps over the lazy dog and then keeps running for quite some distance before it stops.';

describe('markdownFormatter', () => {
    it('formats markdown in the worker', async () => {
        const formatted = await markdownFormatter.format(LONG, WRAP);

        expect(formatted).not.toBe(LONG);
        for (const line of formatted.split('\n')) {
            expect(line.length).toBeLessThanOrEqual(WRAP.printWidth);
        }
    });

    it('honours the width it is given', async () => {
        const formatted = await markdownFormatter.format(LONG, {
            printWidth: 40,
            proseWrap: 'always'
        });

        for (const line of formatted.split('\n')) {
            expect(line.length).toBeLessThanOrEqual(40);
        }
    });

    // Several documents can be saving at once; a reply has to reach its own
    // request rather than whichever was asked last.
    it('matches concurrent replies to their own requests', async () => {
        const bodies = ['# One', '# Two', '# Three', '# Four'];

        const formatted = await Promise.all(
            bodies.map((body) => markdownFormatter.format(body, WRAP))
        );

        expect(formatted).toEqual(bodies);
    });

    // Preferences are read off `workspace.config`, which is `$state`. A Svelte
    // reactive proxy is not structured-cloneable, so posting one throws
    // DataCloneError — synchronously, inside the promise. The client rebuilds the
    // object as plain values, and catches the attempt regardless.
    it('formats against preferences held in reactive state', async () => {
        const config = $state({ prettier: WRAP });

        const formatted = await markdownFormatter.format(LONG, config.prettier);

        expect(formatted.split('\n').length).toBeGreaterThan(1);
    });

    // The contract, stated directly: whatever is wrong with the preferences, the
    // caller gets markdown back and the save proceeds.
    it('returns the markdown unformatted rather than rejecting on bad input', async () => {
        const unusable = { printWidth: 80, proseWrap: () => 'always' };

        await expect(
            markdownFormatter.format(
                LONG,
                unusable as unknown as PrettierPreferences
            )
        ).resolves.toBe(LONG);
    });

    it('leaves a blank document alone', async () => {
        await expect(markdownFormatter.format('', WRAP)).resolves.toBe('');
    });
});
