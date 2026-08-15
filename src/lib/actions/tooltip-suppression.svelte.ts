import type { Action } from 'svelte/action';

import { tooltips } from '$lib/stores/tooltips.svelte';

// Reflects the `tooltips` registry onto <body> as `data-tooltips-suppressed`, which the
// rule in `routes/layout.css` uses to hide any portaled tooltip balloon.
//
// Why an attribute and not just closing the tooltip: balloons are portaled to <body>, so
// they sit outside the route crossfade, and the instant the outgoing page starts its
// out-transition Svelte pauses that subtree's effects. bits-ui therefore never gets to
// unmount the balloon it has already marked closed — the exit animation finishes, nothing
// removes the node, and it snaps back to full opacity for the rest of the transition.
// This action must be used from a component OUTSIDE the transitioning subtree (the `(app)`
// shell), which is the only place still running effects at that moment.
export const tooltipSuppression: Action<HTMLElement> = (node) => {
    $effect(() => {
        node.toggleAttribute('data-tooltips-suppressed', tooltips.suppressed);
    });
};
