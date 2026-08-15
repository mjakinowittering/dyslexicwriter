// Global "no tooltips right now" signal, consulted by the project Tooltip root
// (`$lib/components/Tooltip`). It exists because tooltip content is portaled to
// <body>: the balloon is not a descendant of the keyed <div> that carries the (app)
// shell's route crossfade, so when its trigger navigates away the balloon hangs at
// full opacity over the fading page until the outgoing subtree is finally destroyed.
//
// Module-level runes + an exported object with a getter/method, matching the
// loading / navigation store house style.
let suppressed = $state(false);
let timer: ReturnType<typeof setTimeout> | null = null;

export const tooltips = {
    get suppressed(): boolean {
        return suppressed;
    },

    // Close any open balloon now and refuse to open another for `duration` ms. A timed
    // hold rather than a one-shot close because the outgoing page stays mounted — and
    // hoverable — for the whole crossfade, so a stray pointerenter on that ghost would
    // otherwise re-open the tooltip we just dismissed. Pass 0 for "just close it".
    // Like the Loading bar's anti-flicker hold, this is legitimately timer-driven:
    // `$derived` can't express "and stay off for a second".
    suppress(duration: number): void {
        suppressed = true;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            suppressed = false;
        }, duration);
    }
};
