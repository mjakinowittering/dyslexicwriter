<script lang="ts">
    import { Loading02Icon, RecordIcon } from '@hugeicons/core-free-icons';
    import { prefersReducedMotion } from 'svelte/motion';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import type { SaveState } from '$lib/stores/document.svelte';

    // What is happening to the disk right now. Two states, one row: writing the
    // disk has not seen yet, and a write actually in flight. Autosave waits a few
    // seconds for a pause, so the first comes up whenever a sentence is being
    // written and goes again shortly after it stops — which is the point: the
    // writer should never have to wonder, and never has to look anywhere else to
    // find out. Its sibling says how old the copy on disk is and nothing else, so
    // the two never contradict each other.
    //
    // A step darker than the rest of the bar so it registers, but not
    // `destructive` — pending is the normal state of a document being written,
    // not a failure.
    let { saveState = 'idle' }: { saveState?: SaveState } = $props();

    let saving = $derived(saveState === 'saving');
    let visible = $derived(saveState === 'pending' || saving);

    // One element across both states rather than two branches, so the words do
    // not shift sideways when the glyph swaps mid-save.
    let icon = $derived(saving ? Loading02Icon : RecordIcon);
    let label = $derived(saving ? m.editor_saving() : m.editor_unsaved());

    // A dot is legible at 12px; a stroked glyph at hugeicons' 1.5 weight is not,
    // so the spinner runs a size larger. `animate-spin` is Tailwind's own
    // utility — the one kind of motion Svelte's primitives don't cover, since a
    // transition is mount/unmount and a Tween moves toward a target, while this
    // has to turn indefinitely. Reduced motion drops the rotation and keeps the
    // glyph; the words say "Saving…" either way, which is why the icon never
    // stands on its own here.
    let iconClass = $derived.by(() => {
        if (!saving) return 'size-3';
        return prefersReducedMotion.current
            ? 'size-3.5'
            : 'size-3.5 animate-spin';
    });
</script>

{#if visible}
    <div class="text-foreground flex items-center gap-2">
        <Icon class={iconClass} {icon} />
        <span>{label}</span>
    </div>
{/if}
