<script lang="ts">
    import * as m from '$lib/paraglide/messages';
    import type { SaveState } from '$lib/stores/document.svelte';
    import { relativeTime } from '$lib/utils/relative-time';

    // How old the copy on disk is — the same "Edited 2 minutes ago" the Files
    // screen shows, about the document you are looking at. Autosave waits for a
    // pause in the typing, so a writer who cannot see this has no way of knowing
    // how much of what is on screen has actually reached the disk.
    //
    // It reports an age and nothing else: the document being open is enough to
    // have one (seeded from the file's mtime), and whether there are edits the
    // disk has not seen is StatusbarUnsaved's job, not this one's. The only
    // document with nothing to show here is a new one never yet written.
    let {
        saveState = 'idle',
        savedAt = null
    }: {
        saveState?: SaveState;
        savedAt?: number | null;
    } = $props();

    // Under a minute `relativeTime` has only seconds to report, and a figure that
    // moves every tick reads as fidgeting rather than information. A fresh save
    // gets fixed wording instead.
    const FRESH_MS = 60_000;
    // Granularity is minutes, so the label only needs re-deriving a few times a
    // minute to stay honest.
    const TICK_MS = 15_000;

    let now = $state(Date.now());

    $effect(() => {
        if (savedAt === null) return;

        // A save that has just landed must not be aged by a stale clock.
        now = Date.now();

        const tick = setInterval(() => (now = Date.now()), TICK_MS);
        return () => clearInterval(tick);
    });

    let label = $derived.by(() => {
        if (saveState === 'saving') return m.editor_saving();
        if (savedAt === null) return '';

        // Always an age, never a bare "Saved": this chip only ever reports when
        // the disk copy was made, so it can sit beside "Unsaved changes" without
        // contradicting it. Going quiet instead would mean the bar blinking out
        // every time the writer resumes typing after a save.
        return now - savedAt < FRESH_MS
            ? m.editor_saved_recent()
            : m.editor_saved_when({ when: relativeTime(savedAt) });
    });
</script>

{#if label}
    <span>{label}</span>
{/if}
