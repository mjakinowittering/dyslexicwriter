// Where the page should scroll to keep read-aloud's spoken text in view. Pure
// arithmetic, no DOM — the same split `text-map.ts` makes, and for the same reason:
// this is the part worth unit testing.

// The comfort band, as fractions of the visible height. Text between these two
// lines is left alone; only text outside them causes a scroll. A band rather than
// a fixed anchor is what keeps the page still on a document that already fits.
export const BAND_TOP = 0.15;
export const BAND_BOTTOM = 0.7;

// Where text is brought to when it does fall outside the band — high enough that
// several sentences of what comes next are already on screen.
export const ANCHOR = 0.3;

export interface FollowGeometry {
    // The target's top and bottom in *content* coordinates: pixels from the top of
    // the scrollable content, so they don't shift as the container scrolls.
    top: number;
    bottom: number;
    // The container's visible height (clientHeight).
    viewport: number;
    // Where the container is scrolled to — or where an in-flight scroll is heading.
    scrollTop: number;
    // scrollHeight - clientHeight.
    maxScrollTop: number;
}

/**
 * The scroll position that brings `top`/`bottom` into the comfort band, or `null`
 * when it is already comfortable and the page should stay where it is.
 *
 * A target taller than the band can never fit inside it, so its top is anchored and
 * it then reports comfortable — otherwise every word of a very long sentence would
 * ask for the same scroll again.
 */
export function followScrollTarget(g: FollowGeometry): number | null {
    if (g.viewport <= 0) return null;

    const relativeTop = g.top - g.scrollTop;
    const relativeBottom = g.bottom - g.scrollTop;
    const bandTop = g.viewport * BAND_TOP;
    const bandBottom = g.viewport * BAND_BOTTOM;

    const comfortable =
        relativeTop >= bandTop &&
        (relativeBottom <= bandBottom || relativeTop <= g.viewport * ANCHOR);
    if (comfortable) return null;

    const wanted = g.top - g.viewport * ANCHOR;
    const target = Math.max(0, Math.min(wanted, g.maxScrollTop));
    return target === g.scrollTop ? null : target;
}
