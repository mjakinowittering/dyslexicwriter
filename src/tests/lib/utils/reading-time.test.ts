import { describe, expect, it } from 'vitest';

import { readingTime, readingTimeLabel } from '$lib/utils/reading-time';

// 238 words per minute is the default, so every word count below is chosen to
// land on a particular boundary under it — 238 is one minute exactly, 14280 is
// one hour.
describe('readingTime', () => {
    it('reports seconds below a minute', () => {
        expect(readingTime(100)).toEqual({
            hours: 0,
            minutes: 0,
            seconds: 26
        });
    });

    it('reports minutes below an hour', () => {
        expect(readingTime(1284)).toEqual({
            hours: 0,
            minutes: 6,
            seconds: 0
        });
    });

    it('reports hours and the minutes left over above an hour', () => {
        expect(readingTime(19040)).toEqual({
            hours: 1,
            minutes: 20,
            seconds: 0
        });
    });

    // Flooring the hours off an unrounded total while ceiling the remainder
    // separately put the rollover nowhere: 119.5 minutes came back as one hour
    // and sixty minutes. Rounding the total up once and then splitting it is
    // what stops that.
    it('carries a rounded-up remainder into the hour rather than showing 60', () => {
        const total = 119.5 * 238;

        expect(readingTime(total)).toEqual({
            hours: 2,
            minutes: 0,
            seconds: 0
        });
    });

    it('has nothing to report for an empty document', () => {
        expect(readingTime(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });

    it('takes a reading speed of its own', () => {
        expect(readingTime(200, 100)).toEqual({
            hours: 0,
            minutes: 2,
            seconds: 0
        });
    });
});

// The point of the change these cover: every word below comes out of
// `messages/en.json`, so a singular that reads "1 minutes" is a copy bug the
// message file can fix on its own.
describe('readingTimeLabel', () => {
    it.each([
        [3, 'Read in 1 second'],
        [5, 'Read in 2 seconds'],
        [238, 'Read in 1 minute'],
        [300, 'Read in 2 minutes'],
        [14280, 'Read in 1 hour'],
        [14518, 'Read in 1 hour 1 minute'],
        [19040, 'Read in 1 hour 20 minutes'],
        [28560, 'Read in 2 hours'],
        [28798, 'Read in 2 hours 1 minute'],
        [33320, 'Read in 2 hours 20 minutes']
    ])('reads %i words as "%s"', (wordCount, expected) => {
        expect(readingTimeLabel(wordCount)).toBe(expected);
    });
});
