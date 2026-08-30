<script lang="ts">
    import type { Snippet } from 'svelte';
    import { prefersReducedMotion, Tween } from 'svelte/motion';

    import { motionDuration, motionEasing } from '$lib/config/motion';

    // `narrow` mirrors the settings panel's open state. The document sheet keeps
    // its comfortable measure by default and gives up width only while the panel
    // is taking a column beside it. Driven by the page, not a shared store.
    let { narrow = false, children }: { narrow?: boolean; children: Snippet } =
        $props();

    // The document sheet is a persistent element (never unmounts), so it can't use
    // a `transition:` — animate it natively with a Tween instead (see the
    // `animations` skill). Progress 0→1 eases the measure down as the settings
    // panel takes its column. Asymmetric delay keeps the width change in the
    // correct phase: yield immediately on open, but wait for the panel to fade out
    // before reclaiming the space on close.
    //
    // Reduced motion collapses both to zero so the sheet jumps to its new measure
    // in step with the panel, which gates its two transitions on the same signal.
    const squeeze = new Tween(0, {
        duration: motionDuration,
        easing: motionEasing
    });
    $effect(() => {
        void squeeze.set(
            narrow ? 1 : 0,
            prefersReducedMotion.current
                ? { duration: 0, delay: 0 }
                : { delay: narrow ? 0 : motionDuration }
        );
    });

    // Width and margin both come from tokens, so the page's proportions stay in
    // one place: --doc-max-width is the *text* measure and the sheet is that plus
    // its two margins, in the same page-to-text ratio A4 gives a 1in margin.
    // Written inline rather than as classes because the width is tweened, and
    // because a Tailwind padding utility could not stay in step with the
    // max-width calc.
    //
    let sheetStyle = $derived(
        `max-width: calc(var(--doc-max-width) + 2 * var(--doc-sheet-padding) - 6rem * ${squeeze.current});` +
            ' padding: var(--doc-sheet-padding);'
    );
</script>

<!-- Canvas (the well) → track (the gutter) → sheet (the paper). Below `sm` the
     track drops its gutter and the sheet its corners and shadow, so the paper runs
     edge-to-edge where horizontal room is scarce.

     `flex-1` on the sheet inside the min-height track is what sizes the page: it
     takes exactly the room the window leaves, so an empty or barely-started
     document never puts a scrollbar on screen, and grows from there as one
     continuous page — the page is never cut into pages. -->
<div class="bg-canvas w-full flex-1 overflow-x-hidden overflow-y-auto">
    <div class="flex min-h-screen w-full flex-col sm:px-16 sm:py-14">
        <div
            class="bg-sheet sm:shadow-sheet 3xl:[--doc-max-width:68rem] 3xl:[--doc-sheet-padding:clamp(2rem,8vw,10.8rem)] mx-auto flex w-full flex-1 flex-col sm:rounded-lg sm:border 2xl:[--doc-max-width:54rem] 2xl:[--doc-sheet-padding:clamp(2rem,8vw,8.6rem)]"
            style={sheetStyle}
        >
            {@render children()}
        </div>
    </div>
</div>
