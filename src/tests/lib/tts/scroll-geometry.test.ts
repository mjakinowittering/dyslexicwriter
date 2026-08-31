import { describe, expect, it } from 'vitest';

import {
    ANCHOR,
    BAND_BOTTOM,
    BAND_TOP,
    followScrollTarget
} from '$lib/tts/scroll-geometry';
import type { FollowGeometry } from '$lib/tts/scroll-geometry';

// A 1000px-tall canvas over 5000px of document, so the band edges land on round
// numbers: band 150–700, anchor 300.
const VIEWPORT = 1000;
const MAX_SCROLL = 4000;

function geometry(part: Partial<FollowGeometry>): FollowGeometry {
    return {
        top: 0,
        bottom: 20,
        viewport: VIEWPORT,
        scrollTop: 0,
        maxScrollTop: MAX_SCROLL,
        ...part
    };
}

describe('followScrollTarget', () => {
    it('leaves the page alone while the text sits inside the band', () => {
        const target = followScrollTarget(
            geometry({ top: 400, bottom: 440, scrollTop: 0 })
        );

        expect(target).toBeNull();
    });

    it('anchors text that has fallen below the band', () => {
        // Well past the band's bottom edge, so the voice has outrun the page.
        const target = followScrollTarget(
            geometry({ top: 1800, bottom: 1840, scrollTop: 1000 })
        );

        expect(target).toBe(1800 - VIEWPORT * ANCHOR);
    });

    it('anchors text that has scrolled above the band, as a skip back leaves it', () => {
        const target = followScrollTarget(
            geometry({ top: 1000, bottom: 1040, scrollTop: 1500 })
        );

        expect(target).toBe(1000 - VIEWPORT * ANCHOR);
    });

    it('never scrolls above the top of the document', () => {
        const target = followScrollTarget(
            geometry({ top: 40, bottom: 80, scrollTop: 900 })
        );

        expect(target).toBe(0);
    });

    it('never scrolls past the end of the document', () => {
        const target = followScrollTarget(
            geometry({ top: 4900, bottom: 4940, scrollTop: 1000 })
        );

        expect(target).toBe(MAX_SCROLL);
    });

    it('anchors a sentence taller than the band, then leaves it alone', () => {
        // A sentence 1.5 screens tall can never fit inside the band, so without
        // the "top is already high enough" case it would ask for the same scroll
        // on every word boundary.
        const tall = { top: 2000, bottom: 3500 };

        const first = followScrollTarget(
            geometry({ ...tall, scrollTop: 1000 })
        );
        expect(first).toBe(2000 - VIEWPORT * ANCHOR);

        const second = followScrollTarget(
            geometry({ ...tall, scrollTop: first ?? 0 })
        );
        expect(second).toBeNull();
    });

    it('reports no target when there is nowhere to scroll', () => {
        const target = followScrollTarget(
            geometry({ top: 2000, bottom: 2040, viewport: 0 })
        );

        expect(target).toBeNull();
    });

    it('keeps the band inside the viewport', () => {
        expect(BAND_TOP).toBeLessThan(ANCHOR);
        expect(ANCHOR).toBeLessThan(BAND_BOTTOM);
        expect(BAND_BOTTOM).toBeLessThan(1);
    });
});
