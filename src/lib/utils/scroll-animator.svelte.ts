import { prefersReducedMotion, Tween } from 'svelte/motion';

import { motionEasing } from '$lib/config/motion';

/**
 * Animates one scroll container's `scrollTop`.
 *
 * The read-aloud follower and the back-to-top button both scroll the editor
 * canvas, so the mechanism lives here rather than twice over: the same easing, the
 * same reduced-motion behaviour, the same rule about not fighting the user.
 *
 * Motion is a `Tween` from `svelte/motion` — the project's primitive for a
 * persistent value changing — not `scrollTo({ behavior: 'smooth' })` and not a CSS
 * transition. See the `animations` skill.
 */
export class ScrollAnimator {
    #container: HTMLElement;
    #duration: number;
    #tween: Tween<number>;
    // Where an in-flight animation is heading; null when idle. Callers deciding
    // whether to scroll again read this rather than the container's live
    // scrollTop, so a burst of updates retargets instead of compounding.
    #target: number | null = null;
    #stop: (() => void) | null = null;

    constructor(container: HTMLElement, duration: number) {
        this.#container = container;
        this.#duration = duration;
        // Seeded from the live scroll position: the effect below runs once on
        // creation, and a tween starting at 0 would yank the page to the top.
        this.#tween = new Tween(container.scrollTop, {
            duration,
            easing: motionEasing
        });

        // An effect root, because an animator may be constructed outside a
        // component — the read-aloud follower is a plain module. `new Tween()` and
        // `.set()` work fine outside one (only `Tween.of` requires a root); the
        // effect that writes each frame to the DOM does not.
        this.#stop = $effect.root(() => {
            $effect(() => {
                this.#container.scrollTop = this.#tween.current;
            });
        });
    }

    get target(): number | null {
        return this.#target;
    }

    // Animate to `scrollTop`. Instant under reduced motion, matching every other
    // surface in the app.
    to(scrollTop: number): void {
        // Reseed from the real scroll position when nothing is in flight, so a
        // scroll the user did by hand isn't undone by a stale internal value.
        if (this.#target === null) {
            void this.#tween.set(this.#container.scrollTop, { duration: 0 });
        }

        this.#target = scrollTop;
        const settled = this.#tween.set(scrollTop, {
            duration: prefersReducedMotion.current ? 0 : this.#duration
        });
        void settled.then(() => {
            // A newer move may have superseded this one; only the last one owns
            // the idle flag.
            if (this.#target === scrollTop) this.#target = null;
        });
    }

    destroy(): void {
        this.#stop?.();
        this.#stop = null;
        this.#target = null;
    }
}
