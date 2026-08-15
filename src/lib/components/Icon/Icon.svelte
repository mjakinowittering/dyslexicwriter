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

<HugeiconsIcon {icon} aria-hidden="true" {...rest} class={className} />
