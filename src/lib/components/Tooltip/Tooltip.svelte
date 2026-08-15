<script lang="ts">
    import { Tooltip as TooltipPrimitive } from 'bits-ui';

    import { Root } from '$lib/components/ui/tooltip';

    import { tooltips } from '$lib/stores/tooltips.svelte';

    // The project root for every tooltip in the app — import tooltips from
    // `$lib/components/Tooltip`, never from `$lib/components/ui/tooltip` (that stays a
    // pristine shadcn shim so it can be re-added by the CLI).
    //
    // Same API as the shadcn root; it only adds route-transition suppression. Tooltip
    // content is portaled to <body>, so it sits outside the (app) shell's route
    // crossfade: without this, clicking a tooltipped control that navigates (the editor's
    // back button, a nav-rail link) leaves the balloon at full opacity over the fading
    // page until the outgoing subtree is destroyed.
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
