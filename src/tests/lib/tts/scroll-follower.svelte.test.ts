import type { EditorView } from '@tiptap/pm/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    SCROLL_CONTAINER_SELECTOR,
    ScrollFollower
} from '$lib/tts/scroll-follower.svelte';

// Karaoke-style following: keeping the sentence being read aloud on screen.
//
// The arithmetic deciding *where* to scroll is `scroll-geometry.ts`, already
// covered on its own. What is left here is the DOM half, and its risks are of a
// different kind — measuring costs two `coordsAtPos` calls and a `scrollHeight`
// read, each forcing layout, and word boundaries arrive far faster than the page
// can paint. Acting on every one is layout thrash during the exact activity the
// writer is trying to concentrate through.
//
// Run against a real scroll container: `clientHeight`, `scrollHeight` and
// `scrollTop` all have to agree with each other, and a stand-in that returns
// three unrelated numbers would assert nothing about the geometry.

const VIEWPORT = 300;
const CONTENT = 3000;

let container: HTMLDivElement;

// Where the fake view claims the text sits, in viewport coordinates. The
// follower converts these to content coordinates against the container's own
// box, so a test moves text by moving these.
let coords: { top: number; bottom: number };
let coordsCalls: number;
let throwOnCoords: boolean;

// The parts of an EditorView the follower touches.
function fakeView(dom: Element = container): {
    isDestroyed: boolean;
    dom: Element;
    state: { doc: { content: { size: number } } };
    coordsAtPos: (pos: number) => { top: number; bottom: number };
} {
    return {
        isDestroyed: false,
        dom,
        state: { doc: { content: { size: 1000 } } },
        coordsAtPos: (pos: number) => {
            coordsCalls += 1;
            if (throwOnCoords) {
                throw new RangeError('Position outside of document');
            }
            // `from` asks for the top, `to` for the bottom.
            return pos === 0
                ? { top: coords.top, bottom: coords.top }
                : { top: coords.bottom, bottom: coords.bottom };
        }
    };
}

// The stand-in satisfies only the slice of EditorView the follower reads, so it
// is widened through `unknown` rather than typed as the whole interface.
const asView = (view: unknown): EditorView => view as unknown as EditorView;

const follow = (f: ScrollFollower, view: unknown, from = 0, to = 1): void =>
    f.follow(asView(view), { from, to });

beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute(SCROLL_CONTAINER_SELECTOR.slice(1, -1), '');
    container.style.height = `${VIEWPORT}px`;
    container.style.overflowY = 'auto';

    const content = document.createElement('div');
    content.style.height = `${CONTENT}px`;
    container.appendChild(content);
    document.body.appendChild(container);

    coords = { top: 0, bottom: 20 };
    coordsCalls = 0;
    throwOnCoords = false;
});

afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
});

describe('ScrollFollower', () => {
    // Text comfortably inside the band is text the writer can already see.
    // Scrolling to it would move the page out from under them for no reason —
    // and on a document that fits on one screen, would never stop.
    it('leaves the page alone when the text is already comfortable', async () => {
        const follower = new ScrollFollower();
        coords = { top: 100, bottom: 130 };

        follow(follower, fakeView());
        await vi.waitFor(() => expect(coordsCalls).toBeGreaterThan(0));

        expect(container.scrollTop).toBe(0);
        follower.reset();
    });

    it('brings text below the fold up to the anchor', async () => {
        const follower = new ScrollFollower();
        // Well past the bottom of a 300px viewport.
        coords = { top: 1200, bottom: 1230 };

        follow(follower, fakeView());

        await vi.waitFor(() => expect(container.scrollTop).toBeGreaterThan(0), {
            timeout: 2000
        });
        follower.reset();
    });

    // Word boundaries arrive in bursts far faster than the page can paint, and
    // only the newest range matters by the time a frame runs. Measuring each one
    // is layout thrash for frames the writer never sees.
    it('measures once for a burst of ranges in the same frame', async () => {
        const follower = new ScrollFollower();
        coords = { top: 1200, bottom: 1230 };
        const view = fakeView();

        for (let i = 0; i < 20; i += 1) follow(follower, view, 0, i + 1);

        await vi.waitFor(() => expect(coordsCalls).toBeGreaterThan(0));
        // Two calls is one measurement — `from` and `to`.
        expect(coordsCalls).toBe(2);
        follower.reset();
    });

    // The document stays editable while it is read, so a range captured a moment
    // ago can name a position the document no longer has.
    it('gives up quietly on a range the document has outgrown', async () => {
        const follower = new ScrollFollower();
        coords = { top: 1200, bottom: 1230 };
        throwOnCoords = true;

        expect(() => follow(follower, fakeView())).not.toThrow();
        await vi.waitFor(() => expect(coordsCalls).toBeGreaterThan(0));

        expect(container.scrollTop).toBe(0);
        follower.reset();
    });

    // Checked before measuring rather than after: `coordsAtPos` throws on an
    // out-of-range position, and this is the cheaper answer.
    it('refuses a range past the end of the document', async () => {
        const follower = new ScrollFollower();
        coords = { top: 1200, bottom: 1230 };

        follow(follower, fakeView(), 0, 5000);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(coordsCalls).toBe(0);
        expect(container.scrollTop).toBe(0);
        follower.reset();
    });

    // Paired with the controller's teardown. A frame still owed after a read is
    // stopped would scroll the page once more, with nothing playing.
    it('drops a frame it still owes when reset', async () => {
        const follower = new ScrollFollower();
        coords = { top: 1200, bottom: 1230 };

        follow(follower, fakeView());
        follower.reset();

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(coordsCalls).toBe(0);
        expect(container.scrollTop).toBe(0);
    });

    // The follower should scroll the document canvas or nothing at all — never
    // whichever ancestor happens to have an overflow set.
    it('does nothing without a document canvas to scroll', async () => {
        const follower = new ScrollFollower();
        const orphan = document.createElement('div');
        document.body.appendChild(orphan);
        coords = { top: 1200, bottom: 1230 };

        follow(follower, fakeView(orphan));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // The container is resolved before anything is measured, so a view with
        // no canvas above it costs no layout at all.
        expect(coordsCalls).toBe(0);
        expect(container.scrollTop).toBe(0);
        orphan.remove();
        follower.reset();
    });

    it('ignores a null range', () => {
        const follower = new ScrollFollower();
        const view = fakeView();

        follower.follow(asView(view), null);

        expect(coordsCalls).toBe(0);
        follower.reset();
    });

    it('ignores a view that has been destroyed', () => {
        const follower = new ScrollFollower();
        const view = { ...fakeView(), isDestroyed: true };

        follow(follower, view);

        expect(coordsCalls).toBe(0);
        follower.reset();
    });

    // A second read, after the first editor unmounted, has to resolve the canvas
    // of whatever is mounted now rather than scrolling a detached node.
    it('resolves the canvas again after a reset', async () => {
        const follower = new ScrollFollower();
        coords = { top: 1200, bottom: 1230 };

        follow(follower, fakeView());
        await vi.waitFor(() => expect(coordsCalls).toBeGreaterThan(0));
        follower.reset();

        coordsCalls = 0;
        follow(follower, fakeView());
        await vi.waitFor(() => expect(coordsCalls).toBeGreaterThan(0));

        expect(coordsCalls).toBe(2);
        follower.reset();
    });
});
