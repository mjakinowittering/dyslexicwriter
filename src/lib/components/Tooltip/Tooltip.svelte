<script lang="ts">
    import { Tooltip as TooltipPrimitive } from 'bits-ui';

    import { Root } from '$lib/components/ui/tooltip';

    import { tooltips } from '$lib/stores/tooltips.svelte';

    // The project root for every tooltip in the app — import tooltips from
    // `$lib/components/Tooltip`, never from `$lib/components/ui/tooltip` (that stays a
    // pristine shadcn shim so it can be re-added by the CLI).
    //
    // Same API as the shadcn root; it only adds navigation suppression. Tooltip
    // content is portaled to <body>, so it outlives the subtree that opened it: a
    // tooltipped control that navigates — the editor's back button, or a document
    // row on the Files screen — would otherwise leave its balloon at full opacity
    // over the outgoing page until that subtree is destroyed.
    //
    // Nothing in the app calls `tooltips.suppress()` yet, so this is machinery
    // waiting on a caller — see the "Decide the fate of the tooltip-suppression
    // machinery" todo in README.md, which is where it gets wired up or removed.
    let { open = $bindable(false), ...restProps }: TooltipPrimitive.RootProps =
        $props();

    // Read `open` inside the condition so the effect re-runs — and re-closes — if bits-ui
    // manages to re-open mid-window. It converges: the write makes the condition false.
    $effect(() => {
        if (tooltips.suppressed && open) open = false;
    });
</script>

<!-- `disabled` is the other half: it makes bits-ui's pointerenter/pointermove handlers
     bail before opening, so hovering the still-mounted (but fading) page can't bring the
     balloon back during the transition. -->
<Root bind:open disabled={tooltips.suppressed} {...restProps} />
