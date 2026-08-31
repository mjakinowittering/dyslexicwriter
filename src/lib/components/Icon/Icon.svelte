<script lang="ts">
    import { HugeiconsIcon } from '@hugeicons/svelte';
    import type { ComponentProps } from 'svelte';

    // Every icon in the app draws through here. Hugeicons renders from icon
    // *data* rather than one component per glyph, so the icon arrives as a prop.
    // Unlike Lucide it does not mark its <svg> as decorative, and nearly every
    // icon here sits inside an already-labelled button — so `aria-hidden` is
    // defaulted in one place where a call site cannot forget it. It sits before
    // the rest spread, so a caller that genuinely needs a labelled icon can
    // still override it.
    let {
        icon,
        class: className,
        ...rest
    }: ComponentProps<typeof HugeiconsIcon> = $props();
</script>

<!-- Keyed on the icon data because Hugeicons draws the glyph imperatively: it
     builds the <svg>'s children from whatever `icon` it was handed on mount and
     never looks at that prop again, so a glyph that swaps with state — the
     Files tree's disclosure arrow — would keep drawing the one it started with.
     The key remounts it on a real change, and does nothing on any other update. -->
{#key icon}
    <HugeiconsIcon {icon} aria-hidden="true" {...rest} class={className} />
{/key}
