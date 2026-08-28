<script lang="ts">
    import type { SaveState } from '$lib/stores/document.svelte';

    import SaveIndicator from './StatusbarSaveState.svelte';
    import TimeToRead from './StatusbarTimeToRead.svelte';
    import Unsaved from './StatusbarUnsaved.svelte';
    import WordCount from './StatusbarWordCount.svelte';

    // Always-visible bar along the bottom of the content column. It spans that
    // column only — when the settings panel is open it does not run underneath it.
    let {
        wordCount,
        saveState = 'idle',
        savedAt = null,
        error = ''
    }: {
        wordCount: number;
        saveState?: SaveState;
        savedAt?: number | null;
        error?: string;
    } = $props();
</script>

<footer
    class="border-border text-muted-foreground flex h-9 shrink-0 items-center gap-4 border-t px-4 text-sm"
>
    <WordCount {wordCount} />
    <TimeToRead {wordCount} />

    <!-- Two separate answers: whether the disk is behind, and how far behind. -->
    <div class="ml-auto flex items-center gap-3">
        {#if error}
            <!-- A failed write is the one thing here that must never be quiet. -->
            <span class="text-destructive">{error}</span>
        {:else}
            <Unsaved {saveState} />
            <SaveIndicator {saveState} {savedAt} />
        {/if}
    </div>
</footer>
