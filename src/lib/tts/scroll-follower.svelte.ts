import type { EditorView } from '@tiptap/pm/view';

import { followScrollDuration } from '$lib/config/motion';
import { ScrollAnimator } from '$lib/utils/scroll-animator.svelte';

import { followScrollTarget } from './scroll-geometry';
import type { Range } from './text-map';

// The attribute the editor canvas carries (see `Editor/Page/Page.svelte`). Named
// explicitly rather than walking ancestors guessing at `overflow`: the follower
// should scroll the document canvas or nothing at all.
export const SCROLL_CONTAINER_SELECTOR = '[data-tts-scroll]';

/**
 * Keeps the text being read aloud in view — karaoke-style following.
 *
 * Driven from the controller's single highlight funnel, so it moves with the
 * sentence (exact on every platform) and takes an extra nudge from word boundaries
 * where the engine emits them, which is what keeps a sentence taller than the
 * viewport scrolling through.
 *
 * It scrolls only when the spoken text falls outside a comfort band, so a document
 * that already fits on one screen never moves. The arithmetic lives in
 * `scroll-geometry.ts`; this half is only the DOM.
 */
export class ScrollFollower {
    #container: HTMLElement | null = null;
    #animator: ScrollAnimator | null = null;

    // Bring `range` into view. A no-op when the view is gone, the range no longer
    // resolves, or the editor isn't inside a scrollable canvas (Storybook).
    follow(view: EditorView, range: Range | null): void {
        if (!range || view.isDestroyed) return;

        const container = this.#resolveContainer(view);
        if (!container || !this.#animator) return;

        const size = view.state.doc.content.size;
        if (range.from < 0 || range.to > size) return;

        // The document stays editable while it is read, so a stored range can be
        // stale by the time it gets here — coordsAtPos throws on a position the
        // doc no longer has.
        let top: number;
        let bottom: number;
        try {
            const start = view.coordsAtPos(range.from);
            const end = view.coordsAtPos(range.to);
            const box = container.getBoundingClientRect();
            // Viewport coordinates → content coordinates, so the comparison holds
            // even while a scroll is in flight.
            top = start.top - box.top + container.scrollTop;
            bottom = end.bottom - box.top + container.scrollTop;
        } catch {
            return;
        }

        const target = followScrollTarget({
            top,
            bottom,
            viewport: container.clientHeight,
            // Where a scroll already in flight is heading, so a burst of word
            // boundaries retargets rather than compounding.
            scrollTop: this.#animator.target ?? container.scrollTop,
            maxScrollTop: container.scrollHeight - container.clientHeight
        });
        if (target === null) return;

        this.#animator.to(target);
    }

    // Drop the animator and the cached container — paired with the controller's
    // teardown, so the next read resolves the canvas of whatever editor is mounted.
    reset(): void {
        this.#animator?.destroy();
        this.#animator = null;
        this.#container = null;
    }

    #resolveContainer(view: EditorView): HTMLElement | null {
        if (this.#container?.isConnected) return this.#container;

        const found = view.dom.closest(SCROLL_CONTAINER_SELECTOR);
        if (!(found instanceof HTMLElement)) {
            this.reset();
            return null;
        }

        this.#animator?.destroy();
        this.#container = found;
        this.#animator = new ScrollAnimator(found, followScrollDuration);
        return found;
    }
}
